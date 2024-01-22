// types
export type Success<T> = { success: true; exception: T };
export type Failure = { success: false; message: string; errors?: any };
export type Result<T> = Success<T> | Failure;

// helpers
export const success = <T>(data: T): Success<T> => ({ success: true, exception: data });
export const failure = (message: string, errors?: any): Failure => ({
	success: false,
	message,
	errors,
});
