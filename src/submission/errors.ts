export class InternalError extends Error {
  constructor(message: string, private cause: Error) {
    super(message);
    this.name = "InternalError";
  }
  public getCause() {
    return this.cause;
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}
