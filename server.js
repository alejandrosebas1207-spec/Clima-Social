require("dotenv").config();

const path = require("path");
const express = require("express");
const axios = require("axios");

const app = express();

// =======================================
// CONFIGURACIÓN
// =======================================

const PORT = Number(process.env.PORT) || 3000;
const ASSET_ID = process.env.ASSET_ID || "";
const API_TOKEN = process.env.API_TOKEN || "";
const LIMITE_POR_PAGINA = 500;
const CACHE_TTL_MS = (Number(process.env.CACHE_TTL_SEGUNDOS) || 90) * 1000;
const TIMEOUT_MS = 30000;

if (!ASSET_ID || !API_TOKEN) {
    console.error("[CLIMA-SOCIAL] ⚠  Faltan variables de entorno: ASSET_ID y/o API_TOKEN.");
    console.error("[CLIMA-SOCIAL]    Copia .env.example a .env y completa los valores.");
}

// =======================================
// MIDDLEWARE DE SEGURIDAD
// =======================================

app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "no-referrer",
        "X-XSS-Protection": "0"
    });
    next();
});

// Sirve únicamente la carpeta pública (frontend), nunca archivos del servidor.
app.use(express.static(path.join(__dirname, "public"), {
    dotfiles: "deny",
    maxAge: "1h",
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.(?:html|css|js)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
    }
}));

// =======================================
// CACHÉ EN MEMORIA PARA KOBO
// =======================================

const fs = require("fs");

const RUTA_FALLBACK = path.join(__dirname, "cache-fallback.json");

let cache = {
    datos: null,
    timestamp: 0,
    enProceso: null
};

// Carga inicial del fallback en disco si existe
try {
    if (fs.existsSync(RUTA_FALLBACK)) {
        const fallbackRaw = fs.readFileSync(RUTA_FALLBACK, "utf-8");
        const fallbackParsed = JSON.parse(fallbackRaw);
        cache.datos = { ...fallbackParsed, esCacheFallback: true };
        cache.timestamp = fallbackParsed.obtenidoEn || Date.now();
        console.log("[CLIMA-SOCIAL] 💾 Se cargó la caché de respaldo en disco previamente guardada.");
    }
} catch (e) {
    console.warn("[CLIMA-SOCIAL] No se pudo leer la caché en disco inicial:", e.message);
}

async function guardarCacheFallback(datos) {
    try {
        await fs.promises.writeFile(RUTA_FALLBACK, JSON.stringify(datos, null, 2), "utf-8");
    } catch (e) {
        console.warn("[CLIMA-SOCIAL] ⚠ No se pudo guardar la caché de respaldo en disco:", e.message);
    }
}

async function obtenerDatosKobo() {
    const ahora = Date.now();

    // Cache válida: devolver los datos en memoria (si no es fallback expirado)
    if (cache.datos && !cache.datos.esCacheFallback && ahora - cache.timestamp < CACHE_TTL_MS) {
        return cache.datos;
    }

    // Evitar peticiones duplicadas en paralelo
    if (cache.enProceso) {
        return cache.enProceso;
    }

    cache.enProceso = (async () => {
        let url = `https://kf.kobotoolbox.org/api/v2/assets/${encodeURIComponent(ASSET_ID)}/data/?limit=${LIMITE_POR_PAGINA}`;
        const resultados = [];
        let total = 0;

        while (url) {
            const respuesta = await axios.get(url, {
                headers: { Authorization: `Token ${API_TOKEN}` },
                timeout: TIMEOUT_MS,
                maxRedirects: 5
            });

            total = respuesta.data.count;
            resultados.push(...respuesta.data.results);
            url = respuesta.data.next;
        }

        const datosFrescos = { total, resultados, obtenidoEn: Date.now() };
        cache.datos = datosFrescos;
        cache.timestamp = Date.now();

        // Guardar respaldo en disco asíncronamente
        guardarCacheFallback(datosFrescos);

        return cache.datos;
    })();

    try {
        const datos = await cache.enProceso;
        return datos;
    } finally {
        cache.enProceso = null;
    }
}

// =======================================
// RUTAS DE API
// =======================================

app.get("/api/health", (req, res) => {
    res.json({
        estado: "ok",
        cacheActiva: Boolean(cache.datos),
        esCacheFallback: Boolean(cache.datos?.esCacheFallback),
        cacheEdadSegundos: cache.datos
            ? Math.round((Date.now() - cache.timestamp) / 1000)
            : null
    });
});

app.get("/api/config", (req, res) => {
    res.json({
        nombreProyecto: process.env.NOMBRE_PROYECTO || "Encuesta Artes y Cultura",
        metaTrabajadores: Number(process.env.META_TRABAJADORES) || 2100,
        metaGraduados: Number(process.env.META_GRADUADOS) || 400,
        valorConsentimientoSi: process.env.VALOR_CONSENTIMIENTO_SI || "1",
        fechaCierre: process.env.FECHA_CIERRE || "2026-09-19"
    });
});

app.get("/api/encuestas", async (req, res) => {
    try {
        if (!ASSET_ID || !API_TOKEN) {
            if (cache.datos) {
                console.warn("[CLIMA-SOCIAL] ⚠ Usando caché de respaldo al no tener credenciales de Kobo.");
                res.set("Cache-Control", "no-store");
                return res.json({ ...cache.datos, esCacheFallback: true });
            }
            return res.status(503).json({
                error: "El servidor no tiene configuradas las credenciales de Kobo ni caché previa."
            });
        }
        const datos = await obtenerDatosKobo();
        res.set("Cache-Control", "no-store");
        res.json(datos);
    } catch (error) {
        const mensaje = error.response
            ? `Kobo respondió ${error.response.status}`
            : error.code === "ECONNABORTED"
                ? "Kobo tardó demasiado en responder"
                : error.message;
        console.error(`[${new Date().toLocaleTimeString("es-EC")}] Error al consultar Kobo: ${mensaje}`);

        // Fallback a caché previa si existe en memoria o disco
        if (cache.datos) {
            console.warn("[CLIMA-SOCIAL] 🔄 Servidor retornando caché de respaldo ante error de Kobo.");
            res.set("Cache-Control", "no-store");
            return res.json({ ...cache.datos, esCacheFallback: true });
        }

        res.status(502).json({ error: "No fue posible acceder a Kobo ni se encontraron datos guardados previamente." });
    }
});

// API no encontrada
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Ruta de API no encontrada." });
});

// Cualquier otra ruta → index (SPA simple)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =======================================
// ARRANQUE
// =======================================

app.listen(PORT, () => {
    console.log(`[CLIMA-SOCIAL] Servidor iniciado en http://localhost:${PORT}`);
    console.log(`[CLIMA-SOCIAL] Kobo ${ASSET_ID ? "configurado" : "NO configurado (faltan ASSET_ID/API_TOKEN)"}`);
});
