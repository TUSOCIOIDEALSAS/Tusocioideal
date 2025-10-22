// ===============================
// 🔹 IMPORTACIONES
// ===============================
import { db } from "./confirebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  getDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cargarPermisosEmpleado } from "./login.js"; // ✅ Permisos centralizados

// ===============================
// 🔹 VARIABLES GLOBALES
// ===============================
let permisosEmpleado = {};
let clienteActual = null;
let clienteActualId = null;
let facturasCliente = [];
let unsubscribeFacturas = null;

// ===============================
// 🔹 REFERENCIAS DEL DOM
// ===============================
const form = document.querySelector("form");
const tablaBody = document.querySelector(".tabla-facturas tbody");
const filtroFecha = document.getElementById("filtro-fecha");
const filtroNombre = document.getElementById("filtro-nombre");
const nombreCliente = document.getElementById("nombre-cliente");

// ===============================
// 🔹 MOSTRAR FACTURAS EN TABLA
// ===============================
function mostrarFacturasEnTabla(facturas) {
  if (facturas.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="6">No hay facturas registradas.</td></tr>`;
    return;
  }

  tablaBody.innerHTML = facturas
    .map(
      (f) => `
      <tr data-id="${f.id}">
        <td>${f.fecha}</td>
        <td>${f.servicio}</td>
        <td>${f.descripcion}</td>
        <td>${f.horas}</td>
        <td>$${f.tarifa.toLocaleString()}</td>
        <td>$${f.total.toLocaleString()}</td>
      </tr>`
    )
    .join("");
}

// ===============================
// 🔹 ESCUCHAR CLIENTE ACTIVO
// ===============================
function escucharClienteActivo() {
  const activosRef = collection(db, "clientesActivos");

  onSnapshot(activosRef, async (snapshot) => {
    if (snapshot.empty) {
      nombreCliente.textContent = "Ningún cliente activo";
      clienteActualId = null;
      clienteActual = null;

      const codigoElemento = document.getElementById("codigo-cliente");
      if (codigoElemento) {
        codigoElemento.textContent = "Código: N/A | NIT: N/A";
        codigoElemento.style.color = "#333"; // 🔹 Restablece color
      }

      tablaBody.innerHTML = `<tr><td colspan="6">No hay cliente activo.</td></tr>`;
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
      if (!clienteSnap.exists()) return;

      clienteActualId = clienteSnap.id;
      clienteActual = clienteSnap.data();

      // 🔹 Mostrar nombre del cliente
      nombreCliente.textContent = clienteActual.nombreEmpresa || "Sin nombre";

      // 🔹 Mostrar código y NIT (con color neutral)
      const codigoElemento = document.getElementById("codigo-cliente");
      if (codigoElemento) {
        codigoElemento.textContent = `Código: ${clienteActual.codigo || "N/A"} | NIT: ${clienteActual.nit || "Sin NIT"}`;
        codigoElemento.style.color = "#333"; // evita que quede verde permanente
      }

      // 🔹 Escuchar facturas del cliente activo
      escucharFacturasEnTiempoReal();

    } catch (error) {
      console.error("Error al cargar cliente activo:", error);
    }
  });
}

// ===============================
// 🔹 ESCUCHAR FACTURAS EN TIEMPO REAL
// ===============================
function escucharFacturasEnTiempoReal() {
  if (!clienteActualId) return;
  const factRef = collection(db, "facturacion");
  const q = query(factRef, where("idCliente", "==", clienteActualId));

  if (unsubscribeFacturas) unsubscribeFacturas();

  unsubscribeFacturas = onSnapshot(q, (snapshot) => {
    facturasCliente = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    mostrarFacturasEnTabla(facturasCliente);
  });
}

// ===============================
// 🔹 CREAR NUEVA FACTURA
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!clienteActualId) {
    alert("No hay cliente activo seleccionado.");
    return;
  }

  const servicio = form.querySelector("select").value;
  const descripcion = form.querySelector('input[placeholder="Ej: Publicidad digital 5 horas"]').value.trim();
  const horas = parseFloat(form.querySelector('input[placeholder="Ej: 5"]').value);
  const tarifa = parseFloat(form.querySelector('input[placeholder="Ej: 50000"]').value);
  const total = horas * tarifa;

  if (!servicio || !descripcion || isNaN(horas) || isNaN(tarifa)) {
    alert("Completa todos los campos correctamente.");
    return;
  }

  try {
    await addDoc(collection(db, "facturacion"), {
      idCliente: clienteActualId,
      servicio,
      descripcion,
      horas,
      tarifa,
      total,
      fecha: new Date().toISOString().split("T")[0],
      timestamp: serverTimestamp(),
    });

    form.reset();
    alert("Factura creada correctamente.");
  } catch (error) {
    console.error("Error al crear factura:", error);
    alert("No se pudo crear la factura.");
  }
});

// ===============================
// 🔹 FILTROS
// ===============================
function aplicarFiltros() {
  let filtradas = [...facturasCliente];
  const filtroF = filtroFecha.value;
  const filtroN = filtroNombre.value.toLowerCase();

  if (filtroF) filtradas = filtradas.filter((f) => f.fecha === filtroF);
  if (filtroN)
    filtradas = filtradas.filter(
      (f) =>
        f.servicio.toLowerCase().includes(filtroN) ||
        f.descripcion.toLowerCase().includes(filtroN)
    );

  mostrarFacturasEnTabla(filtradas);
}

filtroFecha.addEventListener("input", aplicarFiltros);
filtroNombre.addEventListener("input", aplicarFiltros);

// ===============================
// 🔹 GENERAR PDF DE FACTURA (VERSIÓN MEJORADA)
// ===============================
tablaBody.addEventListener("click", (e) => {
  const fila = e.target.closest("tr");
  if (!fila || !fila.dataset.id) return;

  const factura = facturasCliente.find((f) => f.id === fila.dataset.id);
  if (!factura || !clienteActual) return;

  generarFacturaPDF(factura);
});

async function generarFacturaPDF(f) {
  const jsPDFModule = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // ===============================
  // 🔷 ENCABEZADO AZUL CORPORATIVO
  // ===============================
  doc.setFillColor(0, 82, 204);
  doc.rect(0, 0, 210, 45, "F"); // Fondo azul

  // Logo
  const logo = new Image();
  logo.src = "logo-tu-socio-ideal.png";
  doc.addImage(logo, "PNG", 15, 10, 25, 25);

  // Texto de encabezado
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TU SOCIO IDEAL", 105, 20, { align: "center" });
  doc.setFontSize(12);
  doc.text("Sistema Integral de Gestión Empresarial", 105, 28, { align: "center" });

  // ===============================
  // 🧾 DATOS PRINCIPALES DE FACTURA
  // ===============================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("FACTURA DE COBRO", 105, 55, { align: "center" });

  const facturaId = `F-${new Date().getTime().toString().slice(-5)}`;
  doc.setFontSize(11);

  // Caja gris con datos
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(15, 60, 180, 25, 3, 3, "F");
  doc.text(`Cliente: ${clienteActual.nombreEmpresa}`, 20, 70);
  doc.text(`NIT: ${clienteActual.nit || "No registrado"}`, 20, 77);
  doc.text(`Fecha: ${f.fecha}`, 150, 70);
  doc.text(`Código Cliente: ${clienteActual.codigo || "N/A"}`, 150, 77);

  // ===============================
  // 📋 TABLA DE DETALLES
  // ===============================
  doc.setFillColor(0, 82, 204);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.rect(15, 95, 180, 10, "F");
  doc.text("Servicio", 20, 102);
  doc.text("Descripción", 60, 102);
  doc.text("Horas", 130, 102);
  doc.text("Tarifa", 150, 102);
  doc.text("Total", 175, 102);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.rect(15, 105, 180, 10);
  doc.text(f.servicio, 20, 112);
  doc.text(f.descripcion.substring(0, 40), 60, 112);
  doc.text(String(f.horas), 130, 112);
  doc.text(`$${f.tarifa.toLocaleString()}`, 150, 112);
  doc.text(`$${f.total.toLocaleString()}`, 175, 112);

  // ===============================
  // 💰 TOTAL A PAGAR
  // ===============================
  doc.setFillColor(230, 236, 245);
  doc.roundedRect(120, 125, 75, 15, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL A PAGAR:", 125, 135);
  doc.text(`$${f.total.toLocaleString()}`, 180, 135, { align: "right" });

  // ===============================
  // 🏢 INFORMACIÓN DE EMPRESA
  // ===============================
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Emitido por:", 20, 150);
  doc.setFont("helvetica", "bold");
  doc.text("TU SOCIO IDEAL S.A.S", 20, 155);
  doc.setFont("helvetica", "normal");
  doc.text("NIT: 901234567-8", 20, 160);
  doc.text("Dirección: Cra 45 #82-90, Barranquilla", 20, 165);
  doc.text("Correo: contacto@tusocioideal.com", 20, 170);
  doc.text("Tel: (605) 385-1020", 20, 175);

  // ===============================
  // 🙏 MENSAJE DE AGRADECIMIENTO
  // ===============================
  doc.setFont("helvetica", "italic");
  doc.setTextColor(60);
  doc.text(
    "Gracias por confiar en nuestros servicios. ¡Tu éxito es nuestro compromiso!",
    105,
    285,
    { align: "center" }
  );

  // ===============================
  // 🧾 PIE DE PÁGINA
  // ===============================
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Documento generado automáticamente por TU SOCIO IDEAL - SAGESST SYSTEM", 105, 292, {
    align: "center",
  });

  const nombre = clienteActual.nombreEmpresa.replace(/\s+/g, "_");
  doc.save(`Factura_${nombre}_${f.fecha}_${facturaId}.pdf`);
}

// ===============================
// 🔹 INICIALIZACIÓN
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  permisosEmpleado = await cargarPermisosEmpleado() || {};

  // 🔒 Verificar permisos
  if (!permisosEmpleado.facturacion) {
    alert("No tienes permiso para acceder a esta sección.");
    window.location.href = "index.html";
    return;
  }

  // 🔄 Escuchar cliente activo
  escucharClienteActivo();
});






