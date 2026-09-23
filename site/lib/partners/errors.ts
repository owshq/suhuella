export class PartnerError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status = 400, code: string | null = null) {
    super(message);
    this.name = "PartnerError";
    this.status = status;
    this.code = code;
  }
}
