import { db } from "./confirebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cargarPermisosEmpleado } from "./login.js";

// ===============================
// 🔹 VARIABLES Y ELEMENTOS DEL DOM
// ===============================
const form = document.getElementById("formAdjunto");
const listaArchivos = document.getElementById("lista-archivos");
const btnLimpiar = document.getElementById("btnLimpiar");
const card = document.querySelector(".card-datos");
const empleadoInput = document.getElementById("empleadoArchivo");
empleadoInput.readOnly = true;

let clienteActualNit = null;
let clienteActual = null;
let permisosEmpleado = {};
let unsubscribeAdjuntos = null;

// ===============================
// 🔹 USUARIO ACTIVO
// ===============================
const usuario = JSON.parse(localStorage.getItem("usuarioActivo"));
if (!usuario) window.location.href = "login.html";
empleadoInput.value = usuario.nombre || "";

// ===============================
// 🔹 MODAL GENERAL
// ===============================
function mostrarModal(titulo, mensaje) {
  const modal = document.getElementById("modal-general");
  document.getElementById("modal-title").textContent = titulo;
  document.getElementById("modal-message").textContent = mensaje;
  modal.style.display = "flex";
  setTimeout(() => (modal.style.display = "none"), 2500);
}

// ===============================
// 🔹 LIMPIAR FORMULARIO
// ===============================
function limpiarFormulario() {
  form.reset();
  empleadoInput.value = usuario.nombre || "";
}

// ===============================
// 🔹 MOSTRAR CLIENTE EN CARD
// ===============================
function mostrarClienteEnCard(c) {
  const estado = c.estado || "Sin estado";
  const claseEstado = estado.toLowerCase() === "activo" ? "activo" : "inactivo";

  card.innerHTML = `
    <div class="icon-container">
      <span class="material-icons icon">apartment</span>
      <span class="estado-texto ${claseEstado}">${estado}</span>
    </div>
    <h3>Datos del Cliente</h3>
    <hr>
    <h4>${c.nombreEmpresa || c.nombre || "Sin Empresa"}</h4>
    <hr>
    <p><strong>Código:</strong> ${c.codigo || "N/A"}</p>
    <p><strong>NIT:</strong> ${c.nit || "N/A"}</p>
    <p><strong>Contacto:</strong> ${[c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(" ")}</p>
    <p><strong>Correo:</strong> ${c.correo || "—"}</p>
    <p><strong>Teléfono:</strong> ${c.telefono || "—"}</p>
    <p><strong>Dirección:</strong> ${c.direccion || "—"}</p>
    <p><strong>Ingreso:</strong> ${c.fechaIngreso || "—"}</p>
  `;
}

// ===============================
// 🔹 ESCUCHAR CLIENTE ACTIVO EN TIEMPO REAL
// ===============================
function escucharClienteActivo() {
  const activosRef = collection(db, "clientesActivos");

  onSnapshot(activosRef, async (snapshot) => {
    if (snapshot.empty) {
      card.innerHTML = `
        <span class="material-icons icon">apartment</span>
        <h3>Datos del Cliente</h3>
        <p>No hay cliente activo actualmente.</p>`;
      listaArchivos.innerHTML =
        "<tr><td colspan='5'>No hay registros del cliente.</td></tr>";
      clienteActualNit = null;
      clienteActual = null;
      return;
    }

    // Buscar el último cliente activo
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

    if (!clienteActivo?.nit) return;

    try {
      const clienteQuery = query(
        collection(db, "clientes"),
        where("nit", "==", clienteActivo.nit)
      );

      let clienteEncontrado = null;
      onSnapshot(clienteQuery, (snap) => {
        if (!snap.empty) {
          clienteEncontrado = snap.docs[0].data();
          clienteActualNit = clienteEncontrado.nit;
          clienteActual = clienteEncontrado;
          mostrarClienteEnCard(clienteActual);
          escucharAdjuntosEnTiempoReal(); // ✅ actualiza la tabla de adjuntos
        }
      });
    } catch (error) {
      console.error("Error al cargar cliente activo:", error);
    }
  });
}

// ===============================
// 🔹 ESCUCHAR ADJUNTOS EN TIEMPO REAL (por NIT)
// ===============================
function escucharAdjuntosEnTiempoReal() {
  if (!clienteActualNit) return;

  if (unsubscribeAdjuntos) unsubscribeAdjuntos(); // limpiar escucha anterior

  try {
    const q = query(
  collection(db, "adjuntos"),
  where("nit", "in", [clienteActualNit, String(clienteActualNit)])
);

    unsubscribeAdjuntos = onSnapshot(q, (snapshot) => {
      listaArchivos.innerHTML = "";
      if (snapshot.empty) {
        listaArchivos.innerHTML =
          "<tr><td colspan='5'>No hay registros del cliente.</td></tr>";
        return;
      }

      snapshot.forEach((docu) => {
        const d = docu.data();
        const fecha = d.fecha?.toDate
          ? d.fecha.toDate().toLocaleString()
          : d.fecha || "Sin fecha";

        const fila = document.createElement("tr");
        fila.innerHTML = `
          <td>${d.cliente || clienteActual.nombreEmpresa || "Desconocido"}</td>
          <td>${d.descripcion || "Sin descripción"}</td>
          <td>${d.empleado || "Desconocido"}</td>
          <td>${fecha}</td>
          <td>
            <button class="ver" data-url="${d.enlace}">
              <span class="material-icons">visibility</span>
            </button>
            <button class="eliminar" data-id="${docu.id}">
              <span class="material-icons">delete</span>
            </button>
          </td>
        `;
        listaArchivos.appendChild(fila);
      });
    });
  } catch (error) {
    console.error("Error escuchando adjuntos:", error);
    listaArchivos.innerHTML =
      "<tr><td colspan='5'>Error al cargar los adjuntos.</td></tr>";
  }
}

// ===============================
// 🔹 GUARDAR NUEVO REGISTRO (Drive + Firestore)
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!clienteActualNit) {
    mostrarModal("Error", "Debes tener un cliente activo para guardar el registro.");
    return;
  }

  const descripcion = document.getElementById("descripcionArchivo").value.trim();
  const empleado = empleadoInput.value.trim() || usuario.nombre;
  const archivo = document.getElementById("archivoAdjunto").files[0];
  const nombreCliente = clienteActual.nombreEmpresa || clienteActual.nombre || "Desconocido";

  if (!descripcion || !archivo) {
    mostrarModal("Campos vacíos", "Completa todos los campos y selecciona un archivo.");
    return;
  }

  try {
    mostrarModal("Subiendo...", "Por favor espera mientras se carga el archivo...");

    // 🟢 Convertir el archivo a Base64
    const base64Archivo = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(archivo);
    });

    // 🟢 Crear el cuerpo para enviar al Apps Script
    const formData = new FormData();
    formData.append("archivo", base64Archivo);
    formData.append("cliente", nombreCliente);
    formData.append("descripcion", descripcion);
    formData.append("empleado", empleado);
    formData.append("nit", clienteActualNit);

    // 🟢 Enviar al Apps Script (tu URL real)
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbxuDUBHrErVOEi7ZDJRbLXV_LlvbjdNULrgAjSjHGkjajhe4EExX3ijv8wce_BFgEry3w/exec",
      {
        method: "POST",
        body: formData,
      }
    );

    const text = await response.text();
    console.log("Respuesta cruda:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Respuesta no válida: " + text);
    }

    console.log("Respuesta parseada:", data);

    if (!data.success) {
      throw new Error(data.error || "Error desconocido al subir archivo.");
    }

    const enlaceArchivo = data.enlace;

    // 🟢 Guardar registro en Firestore
    await addDoc(collection(db, "adjuntos"), {
      nit: clienteActualNit,
      cliente: nombreCliente,
      descripcion,
      enlace: enlaceArchivo,
      empleado,
      fecha: serverTimestamp(),
    });

    mostrarModal("Éxito", "Archivo subido y registrado correctamente.");
    limpiarFormulario();
  } catch (error) {
    console.error("Error al subir o guardar adjunto:", error);
    mostrarModal("Error", "No se pudo guardar el registro.");
  }
});

// ===============================
// 🔹 ACCIONES DE LA TABLA
// ===============================
listaArchivos.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  // Ver archivo
  if (btn.classList.contains("ver")) {
    const url = btn.dataset.url;
    if (url) window.open(url, "_blank");
  }

  // Eliminar archivo
  if (btn.classList.contains("eliminar")) {
    const id = btn.dataset.id;
    const confirmar = confirm("¿Deseas eliminar este registro?");
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "adjuntos", id));
      mostrarModal("Eliminado", "El registro ha sido eliminado.");
    } catch (error) {
      console.error("Error eliminando adjunto:", error);
      mostrarModal("Error", "No se pudo eliminar el registro.");
    }
  }
});

// ===============================
// 🔹 LIMPIAR FORMULARIO
// ===============================
btnLimpiar.addEventListener("click", limpiarFormulario);

// ===============================
// 🔹 INICIO
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  permisosEmpleado = (await cargarPermisosEmpleado()) || {};

  if (!permisosEmpleado.adjuntos) {
    alert("No tienes permiso para acceder a esta sección.");
    window.location.href = "index.html";
    return;
  }

  escucharClienteActivo(); // 🟢 inicia todo el flujo en tiempo real
});











