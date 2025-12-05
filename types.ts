
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

// Updated to match the 8-point checklist
export type IssueType = 
  | 'file_setting'   // 1. File settings/Layout
  | 'font'           // 2. Fonts/Copyright
  | 'image_quality'  // 3. Image Quality/Embeds
  | 'color'          // 4. Color settings (Rich Black)
  | 'bleed'          // 5. Bleed/Margins
  | 'content'        // 6. Content/Proofreading
  | 'annotation'     // 7. Annotations/Die-lines
  | 'format'         // 8. Output Format
  | 'compliance';    // Extra: Ads law/Regulations

export interface DiagnosisIssue {
  id: string;
  type: IssueType;
  text: string;
  suggestion: string;
  location_desc?: string;
  severity: 'high' | 'medium' | 'low';
  box_2d?: BoundingBox; // Normalized 0-1000
}

export interface SourceField {
  key: string;
  value: string;
  category: 'content' | 'compliance' | 'specs';
}

export interface DiffResult {
  id: string;
  field: string;
  sourceValue: string;
  imageValue: string | null;
  status: 'match' | 'error' | 'warning';
  matchType: 'strict' | 'semantic' | 'logic';
  reason?: string;
  box_2d?: BoundingBox;
}

export type WorkflowStep = 'upload' | 'diagnose' | 'source_input' | 'compare';

export interface ViewLayers {
  diagnosis: boolean;
  diff: boolean;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}
