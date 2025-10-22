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
let informesCliente = [];
let unsubscribeInformes = null;

// ===============================
// 🔹 REFERENCIAS DEL DOM
// ===============================
const form = document.querySelector("form");
const tablaBody = document.querySelector(".tabla-informes tbody");
const nombreCliente = document.getElementById("nombre-cliente");

// ===============================
// 🔹 MOSTRAR INFORMES EN TABLA
// ===============================
function mostrarInformesEnTabla(informes) {
  if (informes.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="5">No hay informes registrados para este cliente.</td></tr>`;
    return;
  }

  tablaBody.innerHTML = informes
    .map(
      (inf) => `
        <tr data-id="${inf.id}" class="${inf.nivelUrgencia.toLowerCase()}">
          <td>${inf.fecha}</td>
          <td>${inf.servicio}</td>
          <td>${inf.nivelUrgencia}</td>
          <td>${inf.responsable}</td>
          <td>${inf.informe}</td>
        </tr>`
    )
    .join("");
}

// ===============================
// 🔹 ESCUCHAR CLIENTE ACTIVO (MEJORADO)
// ===============================
function escucharClienteActivo() {
  const activosRef = collection(db, "clientesActivos");

  onSnapshot(activosRef, async (snapshot) => {
    const codigoElemento = document.getElementById("codigo-cliente");
    const nitElemento = document.getElementById("nit-cliente");

    if (snapshot.empty) {
      nombreCliente.textContent = "Ningún cliente activo";
      clienteActual = null;
      clienteActualId = null;

      // 🔹 Restablecer visualmente el código y NIT
      if (codigoElemento) codigoElemento.textContent = "N/A";
      if (nitElemento) nitElemento.textContent = "N/A";

      tablaBody.innerHTML = `<tr><td colspan="5">No hay cliente activo seleccionado.</td></tr>`;
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

      // 🔹 Mostrar nombre, código y NIT
      nombreCliente.textContent = clienteActual.nombreEmpresa || "Sin nombre";
      if (codigoElemento)
        codigoElemento.textContent = clienteActual.codigo || "Sin código";
      if (nitElemento)
        nitElemento.textContent = clienteActual.nit || "Sin NIT";

      // 🔹 Escuchar informes del cliente activo
      escucharInformesEnTiempoReal();

    } catch (error) {
      console.error("Error al cargar cliente activo:", error);
    }
  });
}

// ===============================
// 🔹 ESCUCHAR INFORMES EN TIEMPO REAL
// ===============================
function escucharInformesEnTiempoReal() {
  if (!clienteActualId) return;
  const infRef = collection(db, "database"); // ✅ CORREGIDO
  const q = query(infRef, where("idCliente", "==", clienteActualId));

  if (unsubscribeInformes) unsubscribeInformes();

  unsubscribeInformes = onSnapshot(q, (snapshot) => {
    informesCliente = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    mostrarInformesEnTabla(informesCliente);
  });
}

/// ===============================
// 🔹 GUARDAR NUEVO INFORME
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!clienteActualId) {
    alert("⚠️ No hay cliente activo seleccionado.");
    return;
  }

  // ✅ Usa IDs o names en el HTML para mayor seguridad
  const servicio = form.querySelector("#servicio")?.value || "";
  const nivelUrgencia = form.querySelector("#urgencia")?.value || "Normal";
  const responsable = form.querySelector("#responsable")?.value.trim() || "";
  const fecha = form.querySelector("#fecha")?.value || "";
  const informe = form.querySelector("#informe")?.value.trim() || "";

  if (!servicio || !responsable || !fecha || !informe) {
    alert("⚠️ Completa todos los campos del formulario.");
    return;
  }

  try {
    await addDoc(collection(db, "database"), { // ✅ Colección corregida
      idCliente: clienteActualId,
      nombreCliente: clienteActual.nombreEmpresa,
      nit: clienteActual.nit || "N/A",
      servicio,
      nivelUrgencia,
      responsable,
      fecha,
      informe,
      timestamp: serverTimestamp(),
    });

    form.reset();
    alert("✅ Informe registrado correctamente.");
  } catch (error) {
    console.error("Error al registrar informe:", error);
    alert("❌ No se pudo guardar el informe.");
  }
});

// ===============================
// 🔹 CLIC EN FILA (VER DETALLE EN MODAL)
// ===============================
tablaBody.addEventListener("click", (e) => {
  const fila = e.target.closest("tr");
  if (!fila || !fila.dataset.id) return;

  const informe = informesCliente.find((i) => i.id === fila.dataset.id);
  if (!informe) return;

  // 🔹 Verificar si existe el modal; si no, crearlo dinámicamente
  let modal = document.getElementById("modal-detalle-informe");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-detalle-informe";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="cerrar-modal" id="cerrar-modal-detalle">&times;</span>
        <h2>📋 Detalle del Informe</h2>
        <div id="contenido-detalle-informe"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // 🔹 Estilos rápidos (por si tu HTML no los define aún)
    const estilo = document.createElement("style");
    estilo.textContent = `
      .modal {
        display: none;
        position: fixed;
        z-index: 9999;
        left: 0; top: 0;
        width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.6);
        justify-content: center;
        align-items: center;
      }
      .modal-content {
        background: #fff;
        padding: 20px;
        border-radius: 15px;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: fadeIn 0.2s ease-in-out;
      }
      .cerrar-modal {
        float: right;
        font-size: 22px;
        cursor: pointer;
        color: #555;
      }
      .cerrar-modal:hover {
        color: red;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(estilo);
  }

  // 🔹 Insertar contenido del informe en el modal
  const contenido = `
    <p><strong>🧾 Servicio:</strong> ${informe.servicio}</p>
    <p><strong>⚠️ Urgencia:</strong> ${informe.nivelUrgencia}</p>
    <p><strong>👤 Responsable:</strong> ${informe.responsable}</p>
    <p><strong>📅 Fecha:</strong> ${informe.fecha}</p>
    <hr>
    <p><strong>📝 Descripción:</strong></p>
    <p>${informe.informe}</p>
  `;
  document.getElementById("contenido-detalle-informe").innerHTML = contenido;

  // 🔹 Mostrar el modal
  modal.style.display = "flex";

  // 🔹 Cerrar al hacer clic en la X o fuera del contenido
  document.getElementById("cerrar-modal-detalle").onclick = () => (modal.style.display = "none");
  modal.onclick = (event) => {
    if (event.target === modal) modal.style.display = "none";
  };
});

// ===============================
// 🔹 INICIALIZACIÓN
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  permisosEmpleado = (await cargarPermisosEmpleado()) || {};

  // 🔒 Verificar permisos
  if (!permisosEmpleado.facturacion) {
  alert("No tienes permiso para acceder a esta sección.");
  window.location.href = "index.html";
  return;
}

  escucharClienteActivo();
});

