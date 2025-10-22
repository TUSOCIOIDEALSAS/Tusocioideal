// =====================
// 🔹 IMPORTACIONES
// =====================
import { db } from "./confirebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  limit,
  getDoc,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cargarPermisosEmpleado } from "./login.js";

// =====================
// 🔹 REFERENCIAS DEL DOM
// =====================
const form = document.querySelector("form");
const btnRegistrar = document.querySelector(".registrar");
const btnActualizar = document.querySelector(".actualizar");
const card = document.querySelector(".card-datos");

// =====================
// 🔹 VARIABLES GLOBALES
// =====================
const clientesRef = collection(db, "clientes");
const usuario = JSON.parse(localStorage.getItem("usuarioActivo"));
if (!usuario) window.location.href = "login.html";

let clienteActualId = null;
let clienteActual = null;
let permisosEmpleado = {};
let modoEdicion = false;
let modoRegistro = false;

// =====================
// 🔹 FUNCIONES AUXILIARES
// =====================

// 🧩 Mostrar modal genérico (confirmación o aviso)
function mostrarModal(titulo, mensaje) {
  const modal = document.getElementById("modal-general");
  modal.querySelector("#modal-title").textContent = titulo;
  modal.querySelector("#modal-message").textContent = mensaje;
  modal.style.display = "flex";

  return new Promise((resolve) => {
    modal.querySelector("#modal-confirm-global").onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
    modal.querySelector("#modal-cancel-global").onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
  });
}

// 🧩 Habilitar o bloquear formulario
function bloquearFormulario(bloquear = true, permitirNIT = false) {
  form.querySelectorAll("input, select, textarea").forEach((campo) => {
  if (campo.name === "nit") {
    campo.disabled = !permitirNIT;
  } else {
    campo.disabled = bloquear;
  }
});
}

// 🧩 Limpiar campos del formulario
function limpiarFormulario() {
  form.reset();
}

// =====================
// 🔹 MOSTRAR CLIENTE EN TARJETA
// =====================
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

  // Rellenar formulario con los datos del cliente
  for (const key in c) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) input.value = c[key];
  }

  bloquearFormulario(true);
}

// =====================
// 🔹 CLIENTE ACTIVO O ÚLTIMO CLIENTE
// =====================
async function mostrarClienteActivo() {
  try {
    const activoRef = collection(db, "clientesActivos");
    const snapshotActivo = await getDocs(activoRef);
    if (snapshotActivo.empty) return false;

    // Seleccionar el más reciente
    let clienteActivo = null;
    let ultimaFecha = 0;

    snapshotActivo.forEach((docu) => {
      const data = docu.data();
      const fecha = new Date(data.fechaSeleccion).getTime();
      if (fecha > ultimaFecha) {
        ultimaFecha = fecha;
        clienteActivo = data;
      }
    });

    if (!clienteActivo?.idCliente) return false;

    const clienteRef = doc(db, "clientes", clienteActivo.idCliente);
    const clienteSnap = await getDoc(clienteRef);
    if (!clienteSnap.exists()) return false;

    clienteActualId = clienteSnap.id;
    clienteActual = clienteSnap.data();

    mostrarClienteEnCard(clienteActual);
    return true;
  } catch (error) {
    console.error("Error al mostrar cliente activo:", error);
    return false;
  }
}

async function mostrarUltimoCliente() {
  const q = query(clientesRef, orderBy("fechaIngreso", "desc"), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    card.innerHTML = `
      <span class="material-icons icon">apartment</span>
      <h3>Datos Registrados</h3>
      <hr>
      <p>No hay clientes registrados todavía.</p>
    `;
    return;
  }

  const docu = snapshot.docs[0];
  clienteActualId = docu.id;
  clienteActual = docu.data();
  mostrarClienteEnCard(clienteActual);
}

// =====================
// 🔹 VALIDACIÓN DE NIT
// =====================
async function existeNIT(nit, excluirId = null) {
  const q = query(clientesRef, where("nit", "==", nit));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return false;
  return snapshot.docs.some((docu) => docu.id !== excluirId);
}

// =====================
// 🔹 REGISTRAR CLIENTE
// =====================
btnRegistrar.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!modoRegistro) {
    limpiarFormulario();
    bloquearFormulario(false, true);
    modoRegistro = true;
    await mostrarModal("Nuevo registro", "Formulario habilitado para ingresar un nuevo cliente.");
    return;
  }

  // Capturar los valores del formulario
  const datos = {};
  // Capturar todos los valores del formulario (inputs, selects y textareas)
  form.querySelectorAll("input, select, textarea").forEach((campo) => {
  datos[campo.name] = campo.value.trim();
  });

  // Validar campos mínimos obligatorios
  if (!datos.nit || !datos.telefono || !datos.fechaIngreso) {
    await mostrarModal("Campos obligatorios", "Debes completar al menos NIT, Teléfono y Fecha de ingreso.");
    return;
  }

  // Verificar NIT duplicado
  if (await existeNIT(datos.nit)) {
    await mostrarModal("NIT duplicado", "Ya existe otro cliente con este NIT registrado.");
    return;
  }

  // Generar código automático
  const snapshot = await getDocs(clientesRef);
  const nuevoCodigo = `CL-${(snapshot.size + 1).toString().padStart(4, "0")}`;

  // Crear nuevo cliente (el resto de campos pueden ir vacíos)
  await addDoc(clientesRef, {
    ...datos,
    codigo: nuevoCodigo,
    fechaRegistro: new Date().toISOString(),
  });

  await mostrarModal("Éxito", "Cliente registrado correctamente.");
  bloquearFormulario(true);
  limpiarFormulario();
  await mostrarUltimoCliente();
  modoRegistro = false;
});

// =====================
// 🔹 ACTUALIZAR CLIENTE
// =====================
btnActualizar.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!modoEdicion) {
    bloquearFormulario(false);
    form.querySelector('[name="nit"]').disabled = true;
    modoEdicion = true;
    await mostrarModal("Modo edición", "Puedes editar los datos (excepto el NIT).");
    return;
  }

  if (!clienteActualId) {
    await mostrarModal("Error", "No hay cliente cargado para actualizar.");
    return;
  }

  const confirmar = await mostrarModal("Guardar cambios", "¿Deseas guardar los cambios?");
  if (!confirmar) return;

  const datosActualizados = {};
  form.querySelectorAll("input, select, textarea").forEach((campo) => {
  if (campo.name !== "nit") datosActualizados[campo.name] = campo.value.trim();
  });

  await updateDoc(doc(clientesRef, clienteActualId), {
    ...datosActualizados,
    actualizado: new Date().toISOString(),
  });

  clienteActual = { ...clienteActual, ...datosActualizados };
  mostrarClienteEnCard(clienteActual);
  await mostrarModal("Actualizado", "Datos del cliente actualizados correctamente.");
  bloquearFormulario(true);
  modoEdicion = false;
});

// =====================
// 🔹 INICIALIZACIÓN Y ESCUCHA EN TIEMPO REAL
// =====================
window.addEventListener("DOMContentLoaded", async () => {
  permisosEmpleado = (await cargarPermisosEmpleado()) || {};

  if (!permisosEmpleado.clientes) {
    alert("No tienes permiso para acceder a esta sección.");
    window.location.href = "index.html";
    return;
  }

  bloquearFormulario(true);
  btnRegistrar.disabled = false;
  btnActualizar.disabled = false;

  const hayActivo = await mostrarClienteActivo();
  if (!hayActivo) await mostrarUltimoCliente();

  // 🔄 Escucha en tiempo real
  const activosRef = collection(db, "clientesActivos");
  onSnapshot(activosRef, async (snapshot) => {
    if (!snapshot.empty) {
      console.log("🔄 Cambio detectado en clientesActivos → recargando cliente activo...");
      await mostrarClienteActivo();
    } else {
      console.log("⚠️ No hay cliente activo registrado actualmente.");
    }
  });
});













