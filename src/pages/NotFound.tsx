import { Link } from "react-router";
import { TopBar } from "../components/TopBar";
import { btnClass } from "../components/btnClass";

export function NotFound({ message = "Página não encontrada." }: { message?: string }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="mb-3 text-3xl">Ops</h1>
        <p className="mb-6 text-muted">{message}</p>
        <Link to="/" className={btnClass({ primary: true })}>
          Ver o repertório
        </Link>
      </main>
    </>
  );
}
