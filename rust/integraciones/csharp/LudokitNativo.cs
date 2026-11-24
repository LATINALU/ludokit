// Adaptador C# del núcleo Rust de ludokit para UNITY y GODOT (.NET). Mismo archivo para los dos.
//
// Unity:  copiar ludokit.dll (Windows) / libludokit.so (Linux, Android por ABI) / libludokit.dylib (macOS) a
//         Assets/Plugins/<plataforma>/ y este archivo a Assets/Scripts/. En iOS (biblioteca estática) cambiar
//         Biblioteca a "__Internal".
// Godot:  proyecto con C#; poner la biblioteca junto al ejecutable (o en el PATH) y este archivo en el proyecto.
//
// Regla de oro: UNA llamada por lote (todos los rayos del tick, todas las posiciones), nunca una por entidad.
// Ver docs/RUST.md y docs/MOTORES.md.

using System;
using System.Runtime.InteropServices;

namespace Ludokit
{
    [StructLayout(LayoutKind.Sequential)]
    public struct LudoImpacto
    {
        public uint Id;
        public uint Duenio;
        public uint Etiqueta;
        public float T; // negativo = sin impacto
        public bool Pego => T >= 0f;
    }

    public static class Nativo
    {
        // Sin extensión: .NET agrega .dll/.so/.dylib. En Linux/macOS Rust genera "libludokit"; .NET prueba el prefijo "lib".
        const string Biblioteca = "ludokit";
        public const uint SinDuenio = 0xFFFFFFFF;

        [DllImport(Biblioteca)] public static extern uint ludo_version_abi();

        [DllImport(Biblioteca)] public static extern IntPtr ludo_escena_nueva(float celda);
        [DllImport(Biblioteca)] public static extern void ludo_escena_liberar(IntPtr e);
        [DllImport(Biblioteca)] public static extern void ludo_escena_esfera(IntPtr e, uint id, uint duenio, uint etiqueta, float x, float y, float z, float radio);
        [DllImport(Biblioteca)] public static extern void ludo_escena_caja(IntPtr e, uint id, uint duenio, uint etiqueta, float x0, float y0, float z0, float x1, float y1, float z1);
        [DllImport(Biblioteca)] public static extern void ludo_escena_capsula(IntPtr e, uint id, uint duenio, uint etiqueta, float ax, float ay, float az, float bx, float by, float bz, float radio);
        [DllImport(Biblioteca)] public static extern void ludo_escena_mover(IntPtr e, uint duenio, float dx, float dy, float dz);
        [DllImport(Biblioteca)] public static extern void ludo_escena_limpiar(IntPtr e);
        [DllImport(Biblioteca)] public static extern uint ludo_escena_rayos(IntPtr e, float[] rayos, uint[] ignorar, uint n, [Out] LudoImpacto[] salida);

        [DllImport(Biblioteca)] public static extern IntPtr ludo_horda_nueva(int cols, int filas, byte[] bloqueo, float tile, float velocidad, float aceleracion, float radio, float separacion);
        [DllImport(Biblioteca)] public static extern void ludo_horda_liberar(IntPtr h);
        [DllImport(Biblioteca)] public static extern uint ludo_horda_agregar(IntPtr h, float x, float y);
        [DllImport(Biblioteca)] public static extern void ludo_horda_objetivo(IntPtr h, int c, int f);
        [DllImport(Biblioteca)] public static extern void ludo_horda_paso(IntPtr h, float dt);
        [DllImport(Biblioteca)] public static extern uint ludo_horda_posiciones(IntPtr h, [Out] float[] salida, uint capacidad);
    }

    /// <summary>Escena de disparos con liberación segura (using / Dispose).</summary>
    public sealed class EscenaDisparos : IDisposable
    {
        IntPtr p;
        float[] rayos = new float[0];
        uint[] ignorar = new uint[0];
        LudoImpacto[] salida = new LudoImpacto[0];

        public EscenaDisparos(float celda = 4f) { p = Nativo.ludo_escena_nueva(celda); }

        public void Capsula(uint id, uint duenio, uint zona, float ax, float ay, float az, float bx, float by, float bz, float radio)
            => Nativo.ludo_escena_capsula(p, id, duenio, zona, ax, ay, az, bx, by, bz, radio);

        public void Mover(uint duenio, float dx, float dy, float dz) => Nativo.ludo_escena_mover(p, duenio, dx, dy, dz);

        /// <summary>Lanza todos los disparos del tick de una vez. `origenDir` = n × (ox,oy,oz,dx,dy,dz,largo).</summary>
        public ReadOnlySpan<LudoImpacto> Disparar(float[] origenDir, uint[] tiradores, int n)
        {
            if (salida.Length < n) { salida = new LudoImpacto[n]; }
            Nativo.ludo_escena_rayos(p, origenDir, tiradores, (uint)n, salida);
            return new ReadOnlySpan<LudoImpacto>(salida, 0, n);
        }

        public void Dispose()
        {
            if (p != IntPtr.Zero) { Nativo.ludo_escena_liberar(p); p = IntPtr.Zero; }
        }
    }

    /// <summary>Horda de miles de agentes: un paso por tick fijo, posiciones en un solo arreglo para dibujar instanciado.</summary>
    public sealed class Horda : IDisposable
    {
        IntPtr p;
        public float[] Posiciones = new float[0];
        public int Cantidad { get; private set; }

        public Horda(int cols, int filas, byte[] bloqueo, float tile = 1f, float velocidad = 4f, float aceleracion = 20f, float radio = 0.6f, float separacion = 2f)
        {
            p = Nativo.ludo_horda_nueva(cols, filas, bloqueo, tile, velocidad, aceleracion, radio, separacion);
        }

        public void Agregar(float x, float y) { Nativo.ludo_horda_agregar(p, x, y); Cantidad++; }
        public void Objetivo(int c, int f) => Nativo.ludo_horda_objetivo(p, c, f);

        public void Paso(float dt)
        {
            Nativo.ludo_horda_paso(p, dt);
            if (Posiciones.Length < Cantidad * 2) { Posiciones = new float[Cantidad * 2]; }
            Nativo.ludo_horda_posiciones(p, Posiciones, (uint)Cantidad);
        }

        public void Dispose()
        {
            if (p != IntPtr.Zero) { Nativo.ludo_horda_liberar(p); p = IntPtr.Zero; }
        }
    }
}

/* Uso en Unity (MonoBehaviour):
 *
 *   Ludokit.Horda horda;
 *   void Start() { horda = new Ludokit.Horda(256, 256, mapaBloqueo); for (...) horda.Agregar(x, y); horda.Objetivo(128, 128); }
 *   void FixedUpdate() { horda.Paso(Time.fixedDeltaTime); }        // paso fijo = determinismo
 *   void Update() { // dibujar con Graphics.RenderMeshInstanced usando horda.Posiciones (interpolar si hace falta) }
 *   void OnDestroy() { horda.Dispose(); }
 */
