// Resultado de una operación de dominio: éxito con valor o fallo con un código legible ("sin-fondos").
// Las reglas no lanzan excepciones por casos esperados: la capa de aplicación decide qué mostrar.

export type Resultado<T, E extends string> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly error: E };

export function exito<T>(valor: T): { readonly ok: true; readonly valor: T } {
  return { ok: true, valor };
}

export function fallo<E extends string>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}
