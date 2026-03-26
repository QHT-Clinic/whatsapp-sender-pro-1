import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { router } from "./routes";

// ─── Set WhatsApp favicon dynamically ────────────────────────────────────────
function useFavicon(href: string) {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "shortcut icon";
      link.type = "image/png";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);
}

export default function App() {
  useFavicon(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png"
  );

  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}