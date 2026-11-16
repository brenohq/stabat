import { useEffect, useState } from "react";

type AsyncState<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: Error };

/** carrega dados assíncronos; recarrega quando as dependências mudam */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; state: AsyncState<T> } | null>(null);
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setResult({ key, state: { status: "ok", data } }),
      (error: unknown) =>
        alive &&
        setResult({
          key,
          state: { status: "error", error: error instanceof Error ? error : new Error(String(error)) },
        }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando "deps" muda
  }, [key]);
  return result?.key === key ? result.state : { status: "loading" };
}
