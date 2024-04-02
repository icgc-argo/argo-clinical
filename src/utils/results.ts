// types
export type Success<T> = { success: true; data: T };
export type Failure = { success: false; message: string; errors?: any };
export type Result<T> = Success<T> | Failure;
export type AsyncResult<T> = Promise<Result<T>>;

// helpers
export const success = <T>(data: T): Success<T> => ({ success: true, data });
export const failure = (message: string, errors?: any): Failure => ({
	success: false,
	message,
	errors,
});
