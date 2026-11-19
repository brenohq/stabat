import type { Analytics } from "firebase/analytics";

/**
 * Google Analytics (via Firebase). Só liga no site de produção (stabat.com.br): dev, testes e
 * pré-visualizações do Vercel não contam visitas. O SDK é carregado à parte, depois da página.
 * O page_view não é automático: cada página chama trackPageView (via usePageView) quando o
 * título já está certo; o automático do GA4 saía na troca de rota, ainda com o título da
 * página anterior. Por isso, no GA4, a medição otimizada "Mudanças de página com base em
 * eventos do histórico do navegador" fica desligada.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBVH25YYsTr0NREBCKCTTadacQ2KD7QvBE",
  authDomain: "stabat-b253d.firebaseapp.com",
  projectId: "stabat-b253d",
  storageBucket: "stabat-b253d.firebasestorage.app",
  messagingSenderId: "982299754755",
  appId: "1:982299754755:web:9dd31bd41bb39bcf14a936",
  measurementId: "G-84VK3ZTMZY",
};

const PRODUCTION_HOSTS = new Set(["stabat.com.br", "www.stabat.com.br"]);

type Tracker = { analytics: Analytics; logEvent: typeof import("firebase/analytics").logEvent };

let tracker: Promise<Tracker | null> | null = null;

export function startAnalytics(): void {
  if (!import.meta.env.PROD || !PRODUCTION_HOSTS.has(location.hostname)) return;
  tracker = load();
}

async function load(): Promise<Tracker | null> {
  try {
    const [{ initializeApp }, { initializeAnalytics, isSupported, logEvent }] = await Promise.all([
      import("firebase/app"),
      import("firebase/analytics"),
    ]);
    if (!(await isSupported())) return null;
    const analytics = initializeAnalytics(initializeApp(firebaseConfig), {
      config: { send_page_view: false },
    });
    return { analytics, logEvent };
  } catch {
    // bloqueador de anúncios ou rede: o site segue normal sem estatísticas
    return null;
  }
}

/** uma visita a uma página; collection = "banda" / "quarteto" (dimensão personalizada no GA4) */
export function trackPageView(title: string, collection: string): void {
  if (!tracker) return;
  // endereço lido agora: o SDK pode terminar de carregar depois de outra troca de rota
  const params = {
    page_title: title,
    page_location: location.href,
    page_path: location.pathname,
    collection,
  };
  void tracker.then((t) => t?.logEvent(t.analytics, "page_view", params));
}
