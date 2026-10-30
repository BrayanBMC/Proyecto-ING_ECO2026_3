# Especificación del Proyecto: EconomicApp - Simulador de Créditos Académico

## 1. Resumen
- Propósito: herramienta educativa de Ingeniería Económica para modelar préstamos, convertir tasas, calcular capitalizaciones y amortizaciones, y exportar reportes.
- Tipo: aplicación web (Blazor Server, .NET 8) con capa API REST interna.
- Alcance funcional:
  - Simulador de créditos (conversión de tasa + tabla de amortización Francés/Alemán + gracia + abonos/recálculo + export).
  - Calculadora de Interés Compuesto (despeje de S, P, i, n).
  - Calculadora de Anualidades Anticipadas (despeje de S, P, A).
  - Razones y Proporciones (reparto proporcional, 3 métodos). (no está en el doc base)

## 2. Stack Tecnológico
| Capa | Tecnología | Versión |
|------|-----------|---------|
| Lenguaje | C# | net8.0 |
| Framework | ASP.NET Core / Blazor | .NET 8 |
| Modo Blazor | Server + `InteractiveServerRenderMode` | — (difiere del doc: doc base dice "WebAssembly/Server") |
| UI | Razor Components + Bootstrap Icons + clases Tailwind-like + CSS propio | — |
| API | Controllers MVC (`[ApiController]`) | — |
| Cliente HTTP | `HttpClient` + `SimuladorApiClient` | — |
| Export PDF | texto plano `.txt` (StringBuilder) etiquetado `application/pdf` | — (difiere del doc: no genera PDF real) |
| Export Excel | CSV con `;` + BOM UTF-8, `.csv` etiquetado como xlsx | — (difiere del doc: no genera xlsx real) |
| Testing | N/A (no existe proyecto/arquetipo de tests) | — |
| Build | `dotnet build` / `dotnet run` | SDK `Microsoft.NET.Sdk.Web` |
| Deploy | Docker + docker-compose + scripts LXC | — |

## 3. Arquitectura
- Patrón: componentes Razor (UI) → `SimuladorApiClient` → API Controller → Servicios de dominio (inyectados `Scoped`). Las páginas del Simulador inyectan los servicios **directamente** (no pasan por HTTP); `SimuladorApiClient` existe pero el flujo activo del Simulador usa DI directa.
- Diagrama de capas:
```
[Razor Pages/Components]
  Simulador.razor ─┬─ ITasaService
                   ├─ IAmortizacionService
                   └─ IReporteService
  InteresCompuesto.razor / AnualidadAnti.razor / Razones_*.razor  (lógica en @code, sin servicios)
[API] Controllers/Api/SimuladorController ── (mismos servicios)
[Dominio/Servicios] ServicioConversorTasas · ServicioAmortizacion · ServicioReportes
[DTOs] Models/DTOs/*
```
- Estructura de carpetas clave:
```
/Services            # Motor financiero (CÁLCULO CORE) — ver §10
/Models/DTOs         # Entidades/DTOs y enums — ver §4
/Controllers/Api     # SimuladorController (endpoints REST)
/Components/Pages     # Vistas: Simulador, Interes_Compuesto, Anualidad_Anticipada, Razones_Proporciones
/Components/Shared/Simulador  # Subcomponentes del simulador (tabla, tasa, resumen, flujo caja)
/Components/Services  # SimuladorApiClient (cliente HTTP)
Program.cs           # DI + pipeline
```

## 4. Modelo de Datos
| Entidad | Campos clave | Relaciones | Constraints |
|---------|--------------|------------|-------------|
| `SimulacionRequestDto` | MontoPrestamo(decimal), Plazo(int), FrecuenciaPago, ValorTasa(decimal), TipoTasa, FrecuenciaTasa | entrada de conversión de tasa | Monto `[Range(1,max)]`; Plazo `[Range(1,360)]`; ValorTasa `[Range(0.01,100)]` |
| `AmortizacionRequestDto` | Capital(decimal), Plazo(int), TasaEfectivaPeriodica(decimal), SistemaAmortizacion, PeriodosGracia(int=0) | entrada de tabla | PeriodosGracia `[Range(0,60)]` |
| `ConversionTasaResponseDto` | TasaEfectivaPeriodica(decimal), EsExitoso(bool), Mensaje | salida de tasa | — |
| `AmortizacionResponseDto` | TablaAmortizacion(List<CuotaDto>), TotalInteresesPagados(decimal), TotalPagado(decimal) | salida de tabla | — |
| `CuotaDto` | NumeroPeriodo, SaldoInicial, Interes, AbonoCapital, ValorCuota, SaldoFinal, AbonoExtraordinario; derivados `ValorCuotaMostrado`=Cuota+AbonoExtra, `AbonoCapitalMostrado`=Abono+AbonoExtra | fila de tabla | todos `decimal` |
| `RecalculoRequestDto` | Periodo(int), ValorAbono(decimal), Tipo(TipoRecalculo) | abono/recálculo | — |
| `ExportarReporteRequestDto` | ParametrosCredito(AmortizacionRequestDto), FormatoExportacion | export | — |
| Enums | `Frecuencia`(Anual=1,Semestral=2,Cuatrimestral=3,Trimestral=4,Bimestral=6,Mensual=12,Quincenal=24,Diaria=360); `TipoTasa`(Nominal,Efectiva); `SistemaAmortizacion`(Frances,Aleman); `FormatoExportacion`(PDF,Excel); `TipoRecalculo`(AbonarCapital=1,RecalcularCuota=2) | — | Frecuencia = pagos/año (base 360 para diaria) |

Nota: no existe clase `ParametrosCredito`; su rol lo cumplen `SimulacionRequestDto` + `AmortizacionRequestDto` (difiere del doc).

## 5. Módulos y Funcionalidades
| Módulo | Responsabilidad | Componentes/Servicios | HU / RF |
|--------|-----------------|------------------------|---------|
| Simulador créditos | Orquesta conversión tasa + amortización + export + abonos | `Simulador.razor`, `SimuladorDatosCredito`, `SimuladorTasaInteres`, `SimuladorConfigAmortizacion`, `SimuladorResumen`, `SimuladorFlujoCaja`, `SimuladorTabla`, `SimuladorTasaAlert` | HU-01/03/04/06; RF-01/02 |
| Conversión de tasas | Nominal→EA→periódica equivalente | `ServicioConversorTasas` | HU-02; RF-02 |
| Amortización | Genera tabla Francés/Alemán, gracia, recálculo/abono | `ServicioAmortizacion` | HU-03/04/05 |
| Reportes | Export CSV/TXT | `ServicioReportes` | HU-06 |
| Interés Compuesto | Despeje S/P/i/n + tabla capitalización | `InteresCompuesto.razor` | HU-05 (relacionado) |
| Anualidades Anticipadas | Despeje S/P/A + tabla | `AnualidadAnti.razor` | — (no en doc) |
| Razones y Proporciones | Reparto proporcional (regla de 3 y métodos 2/3) | `Razones*.razor` | — (no en doc) |

## 6. Interfaz Pública / Componentes
| Componente/Servicio | Responsabilidad | Entrada | Salida |
|---------------------|-----------------|---------|--------|
| `ITasaService.CalcularTasaPeriodica` | tasa efectiva periódica | `SimulacionRequestDto` | `ConversionTasaResponseDto` |
| `IAmortizacionService.GenerarTabla` | tabla amortización | `AmortizacionRequestDto` | `AmortizacionResponseDto` |
| `IAmortizacionService.RecalcularDesdePeriodo` | abono extra / recálculo cuota | tabla, periodo, abono, tipo, tasa, sistema | `AmortizacionResponseDto` |
| `IReporteService.GenerarReporteExcel/Pdf` | serializa reporte | response + parámetros | `byte[]` |
| API `POST /api/simulador/convertir-tasa` | expone conversión | `SimulacionRequestDto` | `ConversionTasaResponseDto` |
| API `POST /api/simulador/generar-tabla` | expone tabla | `AmortizacionRequestDto` | `AmortizacionResponseDto` |
| API `POST /api/simulador/exportar-reporte` | archivo descargable | `ExportarReporteRequestDto` | `File` (csv/txt) |

## 7. Autenticación y Autorización
N/A (app educativa local, sin auth). `AllowedHosts: "*"`, antiforgery habilitado por Blazor.

## 8. Configuración y Variables de Entorno
| Variable/Clave | Propósito | Requerida | Default |
|----------------|-----------|-----------|---------|
| `Logging:LogLevel:Default` | nivel log | No | Information |
| `AllowedHosts` | hosts permitidos | No | `*` |
| `ASPNETCORE_ENVIRONMENT` | entorno | No | Production |
(No hay secretos ni connection strings.)

## 9. Flujos Críticos
- **Flujo Simulación:** form → `DataAnnotationsValidator` → `CalcularTasaPeriodica` → set Capital/Plazo/Tasa → `GenerarTabla` → render Resumen/FlujoCaja/Tabla.
- **Flujo Conversión tasa:** si Nominal → EA `(1+j/m)^m−1` → equivalencia a frecuencia de pago; si Efectiva → equivalencia directa.
- **Flujo Abono capital:** seleccionar periodo → `AbonarCapital` reduce saldo y mantiene cuota (reduce plazo) vía `GenerarXConCuotaFija` (while saldo>0).
- **Flujo Recalcular cuota:** seleccionar periodo → `RecalcularCuota` regenera Francés/Alemán con saldo del periodo y cuotas restantes.
- **Flujo Export:** tabla → `GenerarReporteExcel`(CSV;+BOM)/`GenerarReportePdf`(TXT) → `downloadFileFromBytes` (JS interop).

## 10. LÓGICA DE NEGOCIO Y MOTOR DE CÁLCULOS

### 10.1 Conversión de Tasas (`ServicioConversorTasas`, precisión 10 dec)
- Tipos: Nominal, Efectiva; destino = Efectiva Periódica equivalente a `FrecuenciaPago`.
- **Nominal → Efectiva Anual:** `m=(int)FrecuenciaTasa` · Fórmula: `i_EA = (1 + (j/100)/m)^m − 1` · Implementación: `Math.Pow((double)(1 + tasaNominalDecimal/m), m) − 1`.
- **Efectiva ingresada:** se usa tal cual `ValorTasa/100` con su frecuencia origen.
- **Equivalencia entre frecuencias:** Fórmula: `i_dest = (1 + i_orig)^(n1/n2) − 1` donde `n1=origen`, `n2=destino` (ambos = pagos/año del enum) · Implementación: `Math.Pow((double)(1+tasaConocida),(double)(n1/n2)) − 1`. Si `n1==n2` retorna la misma tasa.
- (difiere del doc / inconsistencia interna) Las páginas `InteresCompuesto`/`Anualidad` convierten Nominal→periódica con **división simple** `i = J/m`, NO con `(1+j/m)^m−1`. El backend sí usa la fórmula compuesta.

### 10.2 Sistema Francés — Cuota Fija (`GenerarFrances`)
- **Cuota:** Fórmula: `R = P·i / (1 − (1+i)^(−n))` · Implementación: `capital * (tasa / (1 - Math.Pow((double)(1+tasa), -(double)plazo)))`. Si `tasa==0` → `R = P/n`.
- **Interés periodo:** `I_k = saldo_k · i`.
- **Abono capital:** `A_k = R − I_k`; `saldo_{k+1} = saldo_k − A_k`.
- **Último periodo:** `A = saldoInicial`, `cuota = A + I`, `saldo=0` (cierre forzado).

### 10.3 Sistema Alemán — Abono Constante (`GenerarAleman`)
- **Abono fijo:** `A = P/n` (`capital/plazo`).
- **Interés:** `I_k = saldo_k · i` (decreciente).
- **Cuota:** `R_k = A + I_k` (decreciente).
- `saldo_{k+1} = saldo_k − A`. Último periodo idéntico cierre a 0.

### 10.4 Periodos de Gracia (`AplicarPeriodosGracia`)
- Solo implementa **gracia MUERTA** (interés capitalizado, sin pago): `I = saldo·i`, `saldoFinal = saldo + I`, `AbonoCapital=0`, `ValorCuota=0`. (difiere del doc: no hay variante "con pago de intereses").
- Efecto: incrementa el saldo antes de amortizar; la tabla arranca con fila Periodo 0 (desembolso, SaldoFinal=Capital) y luego g filas de gracia.

### 10.5 Frecuencias de Capitalización
- Modeladas vía enum `Frecuencia` = pagos/año; la capitalización se incorpora en §10.1 (conversión EA→periódica). No hay bucle de capitalización continua; base diaria = 360.
- En calculadoras `InteresCompuesto`/`Anualidad`: `m` = {Meses:12, Bimestres:6, Trimestres:4, Semestres:2, Años:1}.

### 10.6 Decimales y Redondeos
- Backend financiero: `decimal`, `Math.Round(..., 10)` (`DECIMALES_PRECISION=10`) en cada paso.
- Cierre exacto: en Francés/Alemán el último periodo asigna `amortizacion = saldoInicial` y `saldo=0` (evita error de cierre). En `GenerarXConCuotaFija` cuando `amortizacion >= saldo` se cierra a 0.
- `Math.Pow` opera en `double` (conversión puntual) y el resultado se vuelve a `decimal` + Round.
- Calculadoras Razor: usan `double` con `Math.Round(...,2/4)` (menor precisión que el backend).
- Export: formato `F2`/`N2` CultureInvariant (CSV) y es-CO en UI.

### 10.7 Validaciones Matemáticas
- **Regla:** monto/plazo/tasa > 0 · Implementación: `if (MontoPrestamo<=0 || Plazo<=0 || ValorTasa<=0)` → mensaje error (ServicioConversorTasas).
- **Regla:** DataAnnotations · Monto `[Range(1,max)]`, Plazo `[Range(1,360)]`, Tasa `[Range(0.01,100)]`, Gracia `[Range(0,60)]`.
- **Regla abono:** `abono>0` y `abono <= SaldoFinal` del periodo (SimuladorTabla) si no, mensaje error.
- **Regla saldo negativo:** `if (nuevoSaldo<0) nuevoSaldo=0` en recálculo.
- **División por cero:** Francés `if(tasa==0) R=P/n`.

### 10.8 Interés Compuesto (`InteresCompuesto.razor`, double)
- S: `S = P·(1+i)^n`; P: `P = S/(1+i)^n`; i: `i = (S/P)^(1/n) − 1`; n: `n = ln(S/P)/ln(1+i)`.

### 10.9 Anualidad Anticipada (`AnualidadAnti.razor`, double)
- S: `S = A·[((1+i)^n − 1)/i]·(1+i)`; P: `P = A·[(1 − (1+i)^(−n))/i]·(1+i)`.
- A desde S: `A = S / ([((1+i)^n−1)/i]·(1+i))`; A desde P: `A = P / ([(1−(1+i)^(−n))/i]·(1+i))`.

### 10.10 Razones y Proporciones (`Razones_Metodo1`)
- Reparto proporcional: `C_n = (Indice_n · Monto) / ΣIndices`. (métodos 2 y 3 análogos, no leídos en detalle)

## 11. Testing
N/A — no existe proyecto de pruebas ni framework configurado. Recomendado: xUnit con tests unitarios sobre §10.1–10.3 (casos de cierre a 0 y equivalencia de tasas). Comando objetivo: `dotnet test`.

## 12. Scripts y Comandos
| Comando | Propósito |
|---------|-----------|
| `dotnet run` | ejecutar app local |
| `dotnet build` | compilar |
| `docker-compose up` | levantar contenedor |
| `scripts/deploy.sh`, `deploy-simple.sh`, `lxc-deploy.sh`, `deploy-lxc.sh` | despliegue LXC/servidor |

## 13. Dependencias Externas / Integraciones
| Paquete/Servicio | Uso | Config requerida |
|------------------|-----|------------------|
| Bootstrap Icons / CSS (wwwroot) | UI | ninguna |
| JS `downloadFileFromBytes` (wwwroot) | descarga de archivos (interop) | función JS en wwwroot |
| Docker | contenerización | Dockerfile/compose |
(No hay paquetes NuGet externos declarados en `.csproj`.)

## 14. Despliegue
- Blazor Server .NET 8, imagen Docker (`Dockerfile` + `docker-compose.yml`), scripts para contenedores LXC. `UseHttpsRedirection`, `UseStaticFiles`, `UseAntiforgery`. Logs `economicapp.out/err.log`.

## 15. Deuda Técnica / Observaciones
- Export "PDF"/"Excel" son TXT/CSV con MIME engañoso; nombre `.csv`/`.txt`.
- Inconsistencia de conversión de tasa: compuesta en backend vs. simple `J/m` en calculadoras Razor (§10.1).
- `Console.WriteLine("DEBUG ...")` en `RecalcularDesdePeriodo` (código de depuración en producción).
- `SimuladorApiClient` definido pero el Simulador usa DI directa (endpoint API y cliente redundantes/sin usar en el flujo UI).
- `ExportarReporte` del API hardcodea `ValorTasa=18`/Mensual/Anual (parámetros ficticios).
- Reportes fijan "Sistema: Cuota Fija" y "Gracia: 0" sin reflejar la simulación real.
- Gracia solo tipo muerta; no hay gracia con pago de intereses.
- Calculadoras usan `double` (riesgo de precisión) frente a `decimal` del motor de créditos.
- Sin tests; `wwwroot/NewFolder` excluida.

## 16. Checklist de Replicación
- [ ] HU-01 Parametrización (Monto/Plazo/FrecuenciaPago + validaciones Range).
- [ ] HU-02 Equivalencia de tasas (Nominal→EA→periódica, §10.1).
- [ ] HU-03 Tabla de pagos (fila Periodo 0 + amortización, §10.2/10.3).
- [ ] HU-04 Comparativa Francés vs Alemán.
- [ ] HU-05 Escenarios: gracia muerta + frecuencias de capitalización.
- [ ] HU-06 Export CSV/TXT descargable.
- [ ] RNF: precisión `decimal` round 10, cierre exacto a 0 en último periodo.
- [ ] Criterios de aceptación por HU (validaciones §10.7).
- [ ] Fórmulas §10 replicadas exactamente (conversión, Francés, Alemán, gracia, abonos, IC, anualidad anticipada, reparto proporcional).
- [ ] Funcionalidad de abono extraordinario / recálculo (§6, TipoRecalculo).

---

## Anexo: Requisitos implícitos para el nuevo proyecto

- Debe usar `decimal` (no `double`) en todo el motor de amortización y conversión de tasas, con redondeo `Math.Round(x, 10)` en cada operación intermedia.
- La conversión Nominal→Efectiva Anual debe ser compuesta: `i_EA = (1 + (J/100)/m)^m − 1`, con `m` = número de capitalizaciones por año según `Frecuencia`.
- La equivalencia entre frecuencias debe usar el exponente `(n_origen / n_destino)`: `i_dest = (1 + i_orig)^(n1/n2) − 1`, respetando el enum `Frecuencia` (Anual=1, Semestral=2, Cuatrimestral=3, Trimestral=4, Bimestral=6, Mensual=12, Quincenal=24, Diaria=360).
- Una tasa Efectiva ingresada debe conservar su frecuencia de origen y convertirse solo hacia la frecuencia de pago.
- El Sistema Francés debe calcular la cuota con `R = P·i / (1 − (1+i)^(−n))` y manejar el caso `i=0` como `R = P/n`.
- El Sistema Alemán debe usar abono a capital constante `A = P/n`, intereses decrecientes `I_k = saldo_k·i` y cuota `R_k = A + I_k`.
- El último periodo de ambos sistemas debe forzar `abono = saldoInicial` y `saldo = 0` para eliminar el error de cierre por redondeo.
- La tabla debe incluir una fila Periodo 0 (desembolso) con `SaldoFinal = Capital` y los demás campos en 0.
- Los periodos de gracia deben implementar gracia muerta: capitalizar interés (`saldoFinal = saldo + saldo·i`), sin abono ni cuota, antes de iniciar la amortización.
- Debe soportar recálculo desde un periodo en dos modos: (a) abono a capital que reduce plazo manteniendo cuota, y (b) recálculo de cuota manteniendo plazo.
- El abono extraordinario debe validarse: mayor que 0 y no superior al saldo del periodo; el saldo nunca puede quedar negativo.
- Las validaciones de entrada deben replicar: Monto ≥ 1, Plazo 1–360, Tasa 0.01–100%, Gracia 0–60, y rechazar monto/plazo/tasa ≤ 0 en la conversión.
- Los totales deben derivarse de la tabla: `TotalIntereses = Σ interés`, `TotalPagado = Σ cuota (+ abonos extraordinarios)`.
- Debe exponer la lógica como servicios inyectables (`ITasaService`, `IAmortizacionService`, `IReporteService`) y, opcionalmente, endpoints REST equivalentes.
- La calculadora de Interés Compuesto debe permitir despejar S, P, i y n con `S=P(1+i)^n`, `P=S/(1+i)^n`, `i=(S/P)^(1/n)−1`, `n=ln(S/P)/ln(1+i)`.
- La calculadora de Anualidad Anticipada debe aplicar el factor `(1+i)` adicional: `S = A·[((1+i)^n−1)/i]·(1+i)` y `P = A·[(1−(1+i)^(−n))/i]·(1+i)`, con sus despejes de A.
- El módulo de Razones/Proporciones debe repartir proporcionalmente con `C_n = (Indice_n · Monto) / Σ Indices` y cuadrar la suma con el monto total.
- La exportación debe producir reporte tabular con columnas Periodo, Saldo Inicial, Interés, Abono Capital, Cuota, Saldo Final (CSV con BOM UTF-8 y TXT), o idealmente PDF/XLSX reales si se mejora.
- Debe presentar la tasa efectiva periódica resultante al usuario antes de generar la tabla (transparencia pedagógica, no "caja negra").
- La precisión de presentación en UI debe usar cultura `es-CO` y 2 decimales, sin perder la precisión interna de 10 decimales del motor.

Nota de alcance: el proyecto real incluye módulos no descritos en la documentación base (Interés Compuesto, Anualidades Anticipadas, Razones y Proporciones) y presenta una inconsistencia entre la conversión de tasa compuesta del backend y la división simple `J/m` usada en las calculadoras Razor; un nuevo proyecto equivalente debería unificar ese criterio.
