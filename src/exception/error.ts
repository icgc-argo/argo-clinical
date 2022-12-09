export interface ValidationError {
  message: string;
  row: number;
}

export const createValidationErrors = (row: number, message: string): ValidationError[] => [
  {
    row: row + 1, // account for tsv header row
    message,
  },
];
