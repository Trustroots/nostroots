export interface SerializableError extends Error {
  code?: string;
  data?: any;
  message: string;
}

export const getSerializableError = (error: unknown): SerializableError => {
  if (error instanceof Error) {
    const { message } = error;
    const code =
      typeof (error as any).code === "string" ? (error as any).code : undefined;
    const data =
      typeof (error as any).data !== "undefined"
        ? (error as any).data
        : undefined;
    return { message, name: code, code, data };
  }
  return {
    message: "getSerializableError called on non error",
    name: "7VYE53-invalid-error",
  };
};
