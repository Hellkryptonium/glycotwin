import type {
  Content,
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import {
  GeminiProviderError,
  GeminiTimeoutError,
} from './gemini.client.js';
import {
  getPatientProfileToolSchema,
  type GetPatientProfileTool,
  type PatientProfileForAgent,
} from './patient-profile.tool.js';
import type { PatientClinicalSummaryTool } from './patient-clinical-summary.tool.js';

const PATIENT_PROFILE_FUNCTION_NAME = 'get_patient_profile';
const PATIENT_CLINICAL_SUMMARY_FUNCTION_NAME = 'get_patient_clinical_summary';
const MAX_FUNCTION_CALLS = 3;

export interface AiGeminiClient {
  generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse>;
}

export interface AiDiagnosticContext {
  requestId?: string;
  logger?: {
    error(fields: Record<string, unknown>, message: string): void;
  };
}

export interface AiService {
  chat(
    authenticatedDoctorUserId: string,
    selectedPatientProfileId: string,
    userMessage: string,
    diagnosticContext?: AiDiagnosticContext,
  ): Promise<string>;
  reply(
    authenticatedDoctorUserId: string,
    selectedPatientProfileId: string | null,
    userMessage: string,
    history?: Array<{ role: 'DOCTOR' | 'ASSISTANT'; content: string }>,
    diagnosticContext?: AiDiagnosticContext,
  ): Promise<string>;
}

const authenticatedDoctorUserIdSchema = z
  .string()
  .uuid('Authenticated doctor user ID must be a valid UUID');
const selectedPatientProfileIdSchema = z
  .string()
  .uuid('Patient profile ID must be a valid UUID');
const MAX_PROVIDER_MESSAGE_LENGTH = 500;
const noArgumentToolSchema = z.object({}).strict();

function getProviderStatus(error: unknown): number | undefined {
  if (!(error instanceof Object)) return undefined;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const value = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  return typeof value === 'number' ? value : undefined;
}

function getProviderCode(error: unknown): string | undefined {
  if (!(error instanceof Object)) return undefined;
  const candidate = error as { code?: unknown; response?: { statusText?: unknown } };
  if (typeof candidate.code === 'string') return candidate.code.slice(0, 100);
  if (typeof candidate.code === 'number') return String(candidate.code);
  if (typeof candidate.response?.statusText === 'string') return candidate.response.statusText.slice(0, 100);
  return undefined;
}

function sanitizeProviderMessage(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.message) return undefined;
  const sanitized = error.message
    .replace(/authorization\s*[:=][^\n,;]*/gi, 'Authorization=[REDACTED]')
    .replace(/(?:api[_-]?key|x-goog-api-key)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
    .replace(/bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/[?&](?:key|api[_-]?key|token|authorization)=[^&\s]+/gi, '?[REDACTED]')
    .replace(/\b[A-Z0-9]{20,}\b/g, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.slice(0, MAX_PROVIDER_MESSAGE_LENGTH);
}

function logGeminiDiagnostic(
  diagnosticContext: AiDiagnosticContext | undefined,
  error: GeminiTimeoutError | GeminiProviderError,
) {
  if (!diagnosticContext?.logger) return;
  const providerError = error instanceof GeminiProviderError && error.cause instanceof Error
    ? error.cause
    : error;

  diagnosticContext.logger.error({
    errorName: providerError.name,
    httpStatus: getProviderStatus(providerError),
    providerCode: getProviderCode(providerError),
    providerMessage: sanitizeProviderMessage(providerError),
    requestId: diagnosticContext.requestId,
  }, 'Gemini provider request failed');
}

export function createAiService(
  geminiClient: AiGeminiClient,
  patientProfileTool: GetPatientProfileTool,
  model = 'gemini-2.5-flash',
  clinicalSummaryTool?: PatientClinicalSummaryTool,
): AiService {
  return {
    async chat(
      authenticatedDoctorUserId: string,
      selectedPatientProfileId: string,
      userMessage: string,
      diagnosticContext?: AiDiagnosticContext,
    ): Promise<string> {
      return this.reply(authenticatedDoctorUserId, selectedPatientProfileId, userMessage, [], diagnosticContext);
    },
    async reply(
      authenticatedDoctorUserId: string,
      selectedPatientProfileId: string | null,
      userMessage: string,
      history: Array<{ role: 'DOCTOR' | 'ASSISTANT'; content: string }> = [],
      diagnosticContext?: AiDiagnosticContext,
    ): Promise<string> {
      const trustedDoctorUserId = authenticatedDoctorUserIdSchema.parse(authenticatedDoctorUserId);
      const boundPatientProfileId = selectedPatientProfileId === null
        ? null
        : selectedPatientProfileIdSchema.parse(selectedPatientProfileId);
      if (!userMessage.trim()) {
        throw new AppError(400, 'INVALID_AI_MESSAGE', 'Chat message must not be empty.');
      }

      if (boundPatientProfileId) {
        try {
          await patientProfileTool.getPatientProfile(trustedDoctorUserId, boundPatientProfileId);
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }
          throw new AppError(502, 'AI_TOOL_ERROR', 'The approved patient profile could not be loaded.');
        }
      }

      const systemInstruction =
        boundPatientProfileId
          ? 'You are GlycoTwin AI for a verified doctor. Use patient information only through the approved get_patient_profile tool. ' +
            'Never invent patient data. Clearly distinguish observed data from interpretation. Do not request or include a doctor user ID. ' +
            'You provide clinical decision support, not diagnosis or treatment instructions.'
          : 'You are GlycoTwin AI for a verified doctor. This is a general conversation with no patient selected. ' +
            'Do not claim access to patient records, ask for patient identifiers, or provide medical diagnosis or treatment instructions.';

      const contents: Content[] = history.slice(-30).map((entry) => ({
        role: entry.role === 'ASSISTANT' ? 'model' : 'user',
        parts: [{ text: entry.content }],
      }));
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      let functionCallCount = 0;
      const completedCalls = new Set<string>();

      for (;;) {
        let response: GenerateContentResponse;
        try {
          response = await geminiClient.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              ...(boundPatientProfileId ? {
                tools: [{
                  functionDeclarations: [
                    {
                      name: PATIENT_PROFILE_FUNCTION_NAME,
                      description: 'Get the approved patient profile for an actively connected patient.',
                      parametersJsonSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false,
                      },
                    },
                    ...(clinicalSummaryTool ? [{
                      name: PATIENT_CLINICAL_SUMMARY_FUNCTION_NAME,
                      description: 'Get a bounded 30-day clinical summary, active medications, lifestyle counts, and open care items for the selected patient.',
                      parametersJsonSchema: {
                        type: 'object', properties: {}, additionalProperties: false,
                      },
                    }] : []),
                  ],
                }],
              } : {}),
            },
          });
        } catch (error) {
          if (error instanceof GeminiTimeoutError) {
            logGeminiDiagnostic(diagnosticContext, error);
            throw new AppError(504, 'AI_PROVIDER_TIMEOUT', 'The AI provider timed out.');
          }
          if (error instanceof GeminiProviderError) {
            logGeminiDiagnostic(diagnosticContext, error);
          }
          throw new AppError(502, 'AI_PROVIDER_ERROR', 'The AI provider is temporarily unavailable.');
        }

        const candidateContent = response.candidates?.[0]?.content;
        const parts = candidateContent?.parts ?? [];
        const functionCalls = parts
          .map((part) => part.functionCall)
          .filter((call): call is NonNullable<Part['functionCall']> => Boolean(call));

        if (functionCalls.length === 0) {
          const text = parts
            .map((part) => part.text)
            .filter((value): value is string => typeof value === 'string')
            .join('')
            .trim();

          if (!text) {
            throw new AppError(502, 'AI_EMPTY_RESPONSE', 'The AI provider returned no response.');
          }
          return text;
        }

        functionCallCount += functionCalls.length;
        if (functionCallCount > MAX_FUNCTION_CALLS) {
          throw new AppError(429, 'AI_TOOL_CALL_LIMIT', 'The AI request exceeded the function-call limit.');
        }

        if (candidateContent) {
          contents.push(candidateContent);
        }

        const functionResponses: Part[] = [];

        for (const call of functionCalls) {
          if (call.name !== PATIENT_PROFILE_FUNCTION_NAME && call.name !== PATIENT_CLINICAL_SUMMARY_FUNCTION_NAME) {
            throw new AppError(400, 'UNKNOWN_AI_TOOL', 'The AI requested an unsupported function.');
          }

          let requestedPatientProfileId = boundPatientProfileId;
          try {
            // The patient is selected by the doctor and bound on the server. Gemini is
            // intentionally not required to know, choose, or echo a patient identifier.
            const args = call.args;
            if (args !== undefined && !(args instanceof Object && Object.keys(args).length === 0)) {
              requestedPatientProfileId = getPatientProfileToolSchema.parse(args).patientProfileId;
            } else {
              noArgumentToolSchema.parse(args ?? {});
            }
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new AppError(400, 'INVALID_AI_TOOL_ARGUMENTS', 'The AI supplied invalid function arguments.');
            }
            throw new AppError(400, 'INVALID_AI_TOOL_ARGUMENTS', 'The AI supplied invalid function arguments.');
          }

          if (!boundPatientProfileId || requestedPatientProfileId !== boundPatientProfileId) {
            throw new AppError(
              403,
              'PATIENT_SWITCH_ATTEMPT',
              'The AI attempted to access a different patient profile.',
            );
          }

          const repeatKey = `${call.name}:${boundPatientProfileId}`;
          if (completedCalls.has(repeatKey)) {
            throw new AppError(429, 'AI_TOOL_CALL_LOOP', 'The AI repeated an approved function call.');
          }
          completedCalls.add(repeatKey);

          let output: PatientProfileForAgent | Awaited<ReturnType<PatientClinicalSummaryTool['getPatientClinicalSummary']>>;
          try {
            output = call.name === PATIENT_CLINICAL_SUMMARY_FUNCTION_NAME && clinicalSummaryTool
              ? await clinicalSummaryTool.getPatientClinicalSummary(trustedDoctorUserId, boundPatientProfileId)
              : await patientProfileTool.getPatientProfile(trustedDoctorUserId, boundPatientProfileId);
          } catch {
            functionResponses.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: {
                  error: 'Patient profile access was not authorized or the profile was unavailable.',
                },
              },
            });
            continue;
          }

          functionResponses.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { output },
            },
          });
        }

        contents.push({
          role: 'user',
          parts: functionResponses,
        });
      }
    },
  };
}
