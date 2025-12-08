import { ImageSpec, DiagnosisIssue, DiffResult, DeterministicCheck } from '../types';

export interface StoredImageItem {
  id: string;
  base64: string;
  mimeType: string;
  fileName: string;
  description?: string;
  ocrText?: string;
  specs: ImageSpec[];
  issues: DiagnosisIssue[];
  deterministicIssues?: DeterministicCheck[];
  diffs: DiffResult[];
}
