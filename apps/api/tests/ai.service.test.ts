import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/common/errors/app-error.js';
import { createAiService, type AiGeminiClient } from '../src/modules/ai/ai.service.js';
import {
  GeminiProviderError,
  GeminiTimeoutError,
} from '../src/modules/ai/gemini.client.js';
import type { GetPatientProfileTool, PatientProfileForAgent } from '../src/modules/ai/patient-profile.tool.js';

const doctorUserId = '00000000-0000-4000-8000-000000000001';
const patientProfileId = '00000000-0000-4000-8000-000000000013';

function functionCallResponse(args: Record<string, unknown> | undefined, id = 'call-1') {
  return {
    candidates: [{
      content: {
        role: 'model',
        parts: [{
          functionCall: {
            id,
            name: 'get_patient_profile',
            args,
          },
        }],
      },
    }],
  } as never;
}

function textResponse(text: string) {
  return {
    candidates: [{
      content: {
        role: 'model',
        parts: [{ text }],
      },
    }],
  } as never;
}

function createTool(profile: PatientProfileForAgent | null = null) {
  return {
    getPatientProfile: vi.fn(async (authenticatedDoctorUserId: string, selectedPatientProfileId: string) => {
      if (!profile) throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'Denied');
      return profile;
    }),
  } satisfies GetPatientProfileTool;
}

const approvedProfile: PatientProfileForAgent = {
  id: patientProfileId,
  fullName: 'Asha Patient',
  dateOfBirth: new Date('1990-05-10T00:00:00.000Z'),
  gender: 'female',
  diabetesType: 'type 2',
};

describe('AI Gemini function-calling orchestration', () => {
  it('keeps general conversations free of patient tools and data', async () => {
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn().mockResolvedValue(textResponse('I can help with a general workflow question.'));
    const service = createAiService({ generateContent }, tool, 'test-model');

    await expect(service.reply(doctorUserId, null, 'How should I structure a review?')).resolves.toBe(
      'I can help with a general workflow question.',
    );
    expect(tool.getPatientProfile).not.toHaveBeenCalled();
    expect(generateContent.mock.calls[0]![0].config?.tools).toBeUndefined();
  });

  it('rejects an unauthorized selected patient before making a Gemini request', async () => {
    const tool = createTool(null);
    const generateContent = vi.fn();
    const service = createAiService({ generateContent }, tool);

    await expect(service.chat(doctorUserId, patientProfileId, 'Show the patient'))
      .rejects.toMatchObject<AppError>({
        code: 'PATIENT_RELATIONSHIP_REQUIRED',
        statusCode: 403,
      });
    expect(tool.getPatientProfile).toHaveBeenCalledWith(doctorUserId, patientProfileId);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('registers exactly one tool and returns a final natural-language response', async () => {
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn()
      .mockResolvedValueOnce(functionCallResponse({ patientProfileId }))
      .mockResolvedValueOnce(textResponse('The approved patient profile is available.'));
    const gemini: AiGeminiClient = { generateContent };
    const service = createAiService(gemini, tool, 'test-model');

    await expect(service.chat(doctorUserId, patientProfileId, 'Show the patient profile')).resolves.toBe(
      'The approved patient profile is available.',
    );
    expect(tool.getPatientProfile).toHaveBeenCalledTimes(2);
    expect(tool.getPatientProfile).toHaveBeenNthCalledWith(1, doctorUserId, patientProfileId);
    expect(tool.getPatientProfile).toHaveBeenNthCalledWith(2, doctorUserId, patientProfileId);
    expect(generateContent).toHaveBeenCalledTimes(2);

    const firstCall = generateContent.mock.calls[0]![0];
    expect(firstCall.model).toBe('test-model');
    expect(firstCall.config?.tools).toHaveLength(1);
    expect(firstCall.config?.tools?.[0]?.functionDeclarations).toHaveLength(1);
    expect(firstCall.config?.tools?.[0]?.functionDeclarations?.[0]?.name).toBe('get_patient_profile');
    expect(firstCall.config?.tools?.[0]?.functionDeclarations?.[0]?.parametersJsonSchema).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });

    const secondCall = generateContent.mock.calls[1]![0];
    const functionResponseContent = secondCall.contents
      .find((content: { role?: string }) => content.role === 'user');
    expect(functionResponseContent).toBeDefined();
  });

  it('returns the approved result using SDK function-response format', async () => {
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn()
      .mockResolvedValueOnce(functionCallResponse({ patientProfileId }, 'approved-call'))
      .mockResolvedValueOnce(textResponse('Done.'));
    const service = createAiService({ generateContent }, tool);

    await service.chat(doctorUserId, patientProfileId, 'Get this patient');

    const secondCall = generateContent.mock.calls[1]![0];
    const responsePart = secondCall.contents
      .flatMap((content: { parts?: Array<unknown> }) => content.parts ?? [])
      .find((part: { functionResponse?: unknown }) => part.functionResponse);
    expect(responsePart).toMatchObject({
      functionResponse: {
        id: 'approved-call',
        name: 'get_patient_profile',
        response: { output: approvedProfile },
      },
    });
  });

  it('rejects unknown function names', async () => {
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn().mockResolvedValueOnce({
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            functionCall: {
              id: 'unknown',
              name: 'delete_patient',
              args: { patientProfileId },
            },
          }],
        },
      }],
    });
    const service = createAiService({ generateContent }, tool);

    await expect(service.chat(doctorUserId, patientProfileId, 'Delete this patient'))
      .rejects.toMatchObject<AppError>({
        code: 'UNKNOWN_AI_TOOL',
        statusCode: 400,
      });
    expect(tool.getPatientProfile).toHaveBeenCalledWith(doctorUserId, patientProfileId);
  });

  it('binds missing function arguments to the already authorized patient and rejects malformed arguments', async () => {
    const tool = createTool(approvedProfile);
    const missing = createAiService({
      generateContent: vi.fn()
        .mockResolvedValueOnce(functionCallResponse(undefined))
        .mockResolvedValueOnce(textResponse('Done.')),
    }, tool);
    await expect(missing.chat(doctorUserId, patientProfileId, 'Get profile')).resolves.toBe('Done.');

    const malformed = createAiService({
      generateContent: vi.fn().mockResolvedValueOnce(functionCallResponse({
        patientProfileId: 'not-a-uuid',
        doctorUserId,
      })),
    }, tool);
    await expect(malformed.chat(doctorUserId, patientProfileId, 'Get profile'))
      .rejects.toMatchObject<AppError>({ code: 'INVALID_AI_TOOL_ARGUMENTS', statusCode: 400 });
    expect(tool.getPatientProfile).toHaveBeenCalledWith(doctorUserId, patientProfileId);
  });

  it('does not let model arguments override the trusted doctor identity', async () => {
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn()
      .mockResolvedValueOnce(functionCallResponse({
        patientProfileId,
        doctorUserId: '00000000-0000-4000-8000-000000000099',
      }))
      .mockResolvedValueOnce(textResponse('Done.'));
    const service = createAiService({ generateContent }, tool);

    await expect(service.chat(doctorUserId, patientProfileId, 'Get this patient'))
      .rejects.toMatchObject<AppError>({ code: 'INVALID_AI_TOOL_ARGUMENTS', statusCode: 400 });
    expect(tool.getPatientProfile).toHaveBeenCalledWith(doctorUserId, patientProfileId);
  });

  it('rejects a Gemini attempt to switch to a different patient', async () => {
    const otherPatientProfileId = '00000000-0000-4000-8000-000000000014';
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn().mockResolvedValueOnce(
      functionCallResponse({ patientProfileId: otherPatientProfileId }),
    );
    const service = createAiService({ generateContent }, tool);

    await expect(service.chat(doctorUserId, patientProfileId, 'Get a different patient'))
      .rejects.toMatchObject<AppError>({
        code: 'PATIENT_SWITCH_ATTEMPT',
        statusCode: 403,
      });
    expect(tool.getPatientProfile).toHaveBeenCalledTimes(1);
    expect(tool.getPatientProfile).toHaveBeenCalledWith(doctorUserId, patientProfileId);
  });

  it('rejects an invalid selected patient ID before pre-authorizing or calling Gemini', async () => {
    const tool = createTool(approvedProfile);
    const generateContent = vi.fn();
    const service = createAiService({ generateContent }, tool);

    await expect(service.chat(doctorUserId, 'not-a-uuid', 'Get profile')).rejects.toBeInstanceOf(Error);
    expect(tool.getPatientProfile).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('limits function calls and prevents repeated-call loops', async () => {
    const tool = createTool(approvedProfile);
    const repeated = createAiService({
      generateContent: vi.fn()
        .mockResolvedValueOnce(functionCallResponse({ patientProfileId }, 'call-1'))
        .mockResolvedValueOnce(functionCallResponse({ patientProfileId }, 'call-1')),
    }, tool);

    await expect(repeated.chat(doctorUserId, patientProfileId, 'Get profile'))
      .rejects.toMatchObject<AppError>({ code: 'AI_TOOL_CALL_LOOP', statusCode: 429 });

    const fourCalls = createAiService({
      generateContent: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            role: 'model',
            parts: [1, 2, 3, 4].map((number) => ({
              functionCall: {
                id: `call-${number}`,
                name: 'get_patient_profile',
                args: { patientProfileId: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}` },
              },
            })),
          },
        }],
      }),
    }, tool);

    await expect(fourCalls.chat(doctorUserId, patientProfileId, 'Get profiles'))
      .rejects.toMatchObject<AppError>({ code: 'AI_TOOL_CALL_LIMIT', statusCode: 429 });
  });

  it('maps Gemini provider failures to a safe backend error', async () => {
    const tool = createTool(approvedProfile);
    const providerError = new Error('API request failed; Authorization: Bearer secret-token');
    providerError.name = 'ApiError';
    Object.assign(providerError, { status: 401, code: 'UNAUTHENTICATED' });
    const diagnosticLogs: Array<{ fields: Record<string, unknown>; message: string }> = [];
    const logger = {
      error(fields: Record<string, unknown>, message: string) {
        diagnosticLogs.push({ fields, message });
      },
    };
    const service = createAiService({
      generateContent: vi.fn().mockRejectedValue(new GeminiProviderError({ cause: providerError })),
    }, tool);

    await expect(service.chat(doctorUserId, patientProfileId, 'Get profile', {
      requestId: 'request-123',
      logger,
    }))
      .rejects.toMatchObject<AppError>({
        code: 'AI_PROVIDER_ERROR',
        statusCode: 502,
      });
    expect(diagnosticLogs).toEqual([{
      fields: {
        errorName: 'ApiError',
        httpStatus: 401,
        providerCode: 'UNAUTHENTICATED',
        providerMessage: 'API request failed; Authorization=[REDACTED]',
        requestId: 'request-123',
      },
      message: 'Gemini provider request failed',
    }]);
  });

  it('preserves the original provider exception as the cause', () => {
    const providerError = new Error('provider unavailable');
    const wrapped = new GeminiProviderError({ cause: providerError });

    expect(wrapped.cause).toBe(providerError);
  });

  it('maps timeout failures to a safe timeout response and logs diagnostics', async () => {
    const tool = createTool(approvedProfile);
    const diagnosticLogs: Array<Record<string, unknown>> = [];
    const service = createAiService({
      generateContent: vi.fn().mockRejectedValue(new GeminiTimeoutError()),
    }, tool);

    await expect(service.chat(doctorUserId, patientProfileId, 'Get profile', {
      requestId: 'timeout-request',
      logger: {
        error(fields: Record<string, unknown>) {
          diagnosticLogs.push(fields);
        },
      },
    })).rejects.toMatchObject<AppError>({
      code: 'AI_PROVIDER_TIMEOUT',
      statusCode: 504,
    });
    expect(diagnosticLogs).toEqual([expect.objectContaining({
      errorName: 'GeminiTimeoutError',
      requestId: 'timeout-request',
    })]);
  });
});
