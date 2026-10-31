import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Locals {
    requestId: string;
    authenticatedUser?: {
      sub: string;
      role: 'doctor' | 'patient' | 'admin';
      iat: number;
      exp: number;
      jti: string;
    };
  }
}