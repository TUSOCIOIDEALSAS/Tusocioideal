// =====================
// 🔹 IMPORTS
// =====================
import { db } from "./confirebase.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cargarPermisosEmpleado } from "./login.js";

// =====================
// 🔹 REFERENCIAS HTML
// =====================
const card = document.querySelector(".card-datos");
const tablaBody = document.querySelector(".tabla-informes tbody");

// =====================
// 🔹 VARIABLES
// =====================
const informesRef = collection(db, "database");
let clienteActual = null;
let permisosEmpleado = {};

// =====================
// 🔹 MOSTRAR MODAL
// =====================
function mostrarModal(titulo, mensaje) {
  const modal = document.getElementById("modal-general");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");

  modalTitle.textContent = titulo;
  modalMessage.textContent = mensaje;
  modal.style.display = "flex";

  return new Promise((resolve) => {
    document.getElementById("modal-confirm").onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
    document.getElementById("modal-cancel").onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
  });
}

// =====================
// 🔹 ESCUCHAR CLIENTE ACTIVO EN TIEMPO REAL
// =====================
function escucharClienteActivo() {
  const activosRef = collection(db, "clientesActivos");

  onSnapshot(activosRef, async (snapshot) => {
    if (snapshot.empty) {
      console.warn("⚠️ No hay cliente activo.");
      tablaBody.innerHTML = `<tr><td colspan="4">Esperando cliente activo...</td></tr>`;
      return;
    }

    let clienteActivo = null;
    let ultimaFecha = 0;

    snapshot.forEach((docu) => {
      const data = docu.data();
      const fecha = new Date(data.fechaSeleccion).getTime() || 0;
      if (fecha > ultimaFecha) {
        ultimaFecha = fecha;
        clienteActivo = data;
      }
    });

    if (!clienteActivo?.idCliente) return;

    try {
      const clienteRef = doc(db, "clientes", clienteActivo.idCliente);
      const clienteSnap = await getDoc(clienteRef);

      if (!clienteSnap.exists()) {
        console.warn("⚠️ Cliente activo no encontrado en 'clientes'.");
        return;
      }

      const c = clienteSnap.data();
      clienteActual = c;

      // 🔹 Determinar estado y color
      const estado = c.estado || "Sin estado";
      const claseEstado = estado.toLowerCase() === "activo" ? "activo" : "inactivo";

      // ✅ Mostrar datos del cliente con estado visible
      card.innerHTML = `
        <div class="icon-container">
          <span class="material-icons icon">apartment</span>
          <span class="estado-texto ${claseEstado}">${estado}</span>
        </div>
        <h3>Datos del Cliente</h3>
        <hr>
        <h4>${c.nombreEmpresa || "Sin Empresa"}</h4>
        <hr>
        <p><strong>Código:</strong> ${c.codigo || "N/A"}</p>
        <p><strong>NIT:</strong> ${c.nit || "N/A"}</p>
        <p><strong>Contacto:</strong> ${[c.primerNombre, c.primerApellido].filter(Boolean).join(" ")}</p>
        <p><strong>Correo:</strong> ${c.correo || "—"}</p>
        <p><strong>Teléfono:</strong> ${c.telefono || "—"}</p>
        <p><strong>Dirección:</strong> ${c.direccion || "—"}</p>
        <p><strong>Ingreso:</strong> ${c.fechaIngreso || "—"}</p>
      `;

      // ✅ Cargar informes del cliente
      if (c.nit) {
        console.log("📡 Cliente activo detectado:", c.nombreEmpresa, "| NIT:", c.nit);
        cargarInformesCliente(String(c.nit).trim());
      } else {
        console.warn("⚠️ Cliente sin NIT, no se pueden cargar informes.");
      }

    } catch (error) {
      console.error("❌ Error al obtener cliente activo:", error);
    }
  });
}

// =====================
// 🔹 CARGAR INFORMES DEL CLIENTE EN TIEMPO REAL
// =====================
function cargarInformesCliente(nitCliente) {
  console.log("🔍 Buscando informes para NIT:", nitCliente);

  const q = query(collection(db, "database"), where("nit", "==", nitCliente));

  onSnapshot(q, (snapshot) => {
    console.log("📄 Informes encontrados:", snapshot.size);
    if (snapshot.empty) {
      tablaBody.innerHTML = `<tr><td colspan="4">No hay informes registrados para este cliente.</td></tr>`;
      return;
    }

    tablaBody.innerHTML = "";

    snapshot.forEach((docu) => {
      const d = docu.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${d.servicio || "Sin título"}</td>
        <td>PDF</td>
        <td>${d.fecha || "Sin fecha"}</td>
        <td>
          <button class="descargar" data-id="${docu.id}">Descargar</button>
        </td>
      `;
      tablaBody.appendChild(tr);
    });

    // 🔹 Eventos de descarga PDF
    document.querySelectorAll(".descargar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const ref = doc(db, "database", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          generarPDF(snap.data());
        } else {
          await mostrarModal("Error", "No se encontró el informe seleccionado.");
        }
      });
    });
  });
}

// =====================
// 🔹 GENERAR PDF DE INFORME
// =====================
async function generarPDF(datos) {
  try {
    const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const jsPDFConstructor =
      mod?.jsPDF ||
      (mod?.default && mod.default.jsPDF) ||
      (window?.jspdf && window.jspdf.jsPDF) ||
      window?.jspdf;

    if (!jsPDFConstructor) throw new Error("No se pudo inicializar jsPDF correctamente.");

    const doc = new jsPDFConstructor();

    // === ENCABEZADO ===
    doc.setFillColor(24, 90, 160);
    doc.rect(0, 0, 210, 35, "F");

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "logo-tu-socio-ideal.png";
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const logoDataUrl = canvas.toDataURL("image/png");
      doc.addImage(logoDataUrl, "PNG", 15, 6, 25, 25);
    } catch {
      console.warn("⚠️ No se pudo cargar el logo.");
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SAGESST S.A.S", 105, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text("Informe de Acompañamiento Empresarial", 105, 23, { align: "center" });
    doc.text("Sistema de Asesoría y Gestión Estratégica", 105, 29, { align: "center" });

    // === DATOS DEL CLIENTE ===
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Datos del Cliente", 15, 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const cliente = datos.nombreCliente || clienteActual?.nombreEmpresa || "Sin nombre";
    const nit = datos.nit || clienteActual?.nit || "N/A";
    const servicio = datos.servicio || "No especificado";
    const fecha = datos.fecha || new Date().toISOString().split("T")[0];
    const responsable = datos.responsable || "N/A";
    const nivelUrgencia = datos.nivelUrgencia || "Normal";

    const infoY = 52;
    doc.text(`Cliente: ${cliente}`, 20, infoY);
    doc.text(`NIT: ${nit}`, 120, infoY);
    doc.text(`Servicio: ${servicio}`, 20, infoY + 7);
    doc.text(`Fecha: ${fecha}`, 120, infoY + 7);
    doc.text(`Nivel de Urgencia: ${nivelUrgencia}`, 20, infoY + 14);
    doc.text(`Responsable: ${responsable}`, 120, infoY + 14);

    // === DESARROLLO DEL INFORME ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Desarrollo del Informe", 15, infoY + 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const texto = datos.informe || "No se registró contenido para este informe.";
    const splitTexto = doc.splitTextToSize(texto, 170);
    doc.text(splitTexto, 20, infoY + 38, { align: "justify" });

    const nextY = infoY + 38 + splitTexto.length * 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Conclusiones y Acciones a Realizar", 15, nextY + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(
      "El equipo de SAGESST S.A.S. continuará brindando acompañamiento al cliente según las necesidades detectadas, con el fin de fortalecer la gestión interna, la planeación financiera y las estrategias organizacionales.",
      20,
      nextY + 18,
      { align: "justify", maxWidth: 170 }
    );

    // === FIRMA Y PIE DE PÁGINA ===
    const firmaY = 265;
    doc.text("Firma del responsable:", 20, firmaY);
    doc.line(20, firmaY + 2, 100, firmaY + 2);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      "Documento generado automáticamente por el sistema SAGESST S.A.S.",
      105,
      285,
      { align: "center" }
    );

    // === GUARDAR ===
    const safeNombre = cliente.replace(/\s+/g, "_");
    const nombreArchivo = `Informe_${safeNombre}_${fecha}.pdf`;
    doc.save(nombreArchivo);

  } catch (err) {
    console.error("Error generando PDF:", err);
    await mostrarModal("Error", "No se pudo generar el informe correctamente.");
  }
}

// =====================
// 🔹 INICIALIZAR
// =====================
window.addEventListener("DOMContentLoaded", async () => {
  permisosEmpleado = (await cargarPermisosEmpleado()) || {};

  if (!permisosEmpleado.informes) {
    alert("No tienes permiso para acceder a esta sección.");
    window.location.href = "index.html";
    return;
  }

  escucharClienteActivo();
});







