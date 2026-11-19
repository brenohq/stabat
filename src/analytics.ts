/**
 * Google Analytics (via Firebase). Só liga no site de produção (stabat.com.br): dev, testes e
 * pré-visualizações do Vercel não contam visitas. O SDK é carregado à parte, depois da página.
 * As trocas de rota do React Router viram page_view sozinhas (medição otimizada do GA4,
 * "mudanças de página com base em eventos do histórico do navegador").
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

export async function startAnalytics(): Promise<void> {
  if (!import.meta.env.PROD || !PRODUCTION_HOSTS.has(location.hostname)) return;
  try {
    const [{ initializeApp }, { getAnalytics, isSupported }] = await Promise.all([
      import("firebase/app"),
      import("firebase/analytics"),
    ]);
    if (!(await isSupported())) return;
    getAnalytics(initializeApp(firebaseConfig));
  } catch {
    // bloqueador de anúncios ou rede: o site segue normal sem estatísticas
  }
}
