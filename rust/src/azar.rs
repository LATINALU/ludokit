//! Generadores deterministas: PCG32 (XSH-RR, período 2^64) y mulberry32 (rápido, 32 bits).

/// PCG32. Mismas salidas que `Pcg32` de la versión TypeScript.
#[derive(Clone, Debug)]
pub struct Pcg32 {
    estado: u64,
    inc: u64,
}

impl Pcg32 {
    pub fn nuevo(semilla: u64) -> Self {
        let mut a = Pcg32 { estado: 0, inc: (semilla << 1) | 1 };
        a.u32();
        a.estado = a.estado.wrapping_add(semilla ^ 0x853c_49e6_748f_ea9b);
        a.u32();
        a
    }

    pub fn u32(&mut self) -> u32 {
        let viejo = self.estado;
        self.estado = viejo.wrapping_mul(6364136223846793005).wrapping_add(self.inc);
        let xs = (((viejo >> 18) ^ viejo) >> 27) as u32;
        let rot = (viejo >> 59) as u32;
        xs.rotate_right(rot)
    }

    /// [0, 1) con 24 bits.
    pub fn f32(&mut self) -> f32 {
        (self.u32() >> 8) as f32 / (1u32 << 24) as f32
    }

    /// Entero en [a, b] inclusive.
    pub fn rango(&mut self, a: i32, b: i32) -> i32 {
        if b <= a {
            return a;
        }
        a + (self.u32() % (b - a + 1) as u32) as i32
    }

    pub fn prob(&mut self, p: f32) -> bool {
        self.f32() < p
    }

    pub fn elegir<'a, T>(&mut self, v: &'a [T]) -> &'a T {
        &v[(self.u32() as usize) % v.len()]
    }
}

/// Semilla derivada para un sub-sistema (nivel, sala): semilla + n · φ64.
pub fn derivar_semilla(semilla: u64, n: u64) -> u64 {
    semilla.wrapping_add(n.wrapping_mul(0x9E37_79B9_7F4A_7C15))
}

/// mulberry32: mismas salidas que `AzarSemilla` de la versión TypeScript.
#[derive(Clone, Debug)]
pub struct Mulberry32(u32);

impl Mulberry32 {
    pub fn nuevo(semilla: u32) -> Self {
        Mulberry32(semilla)
    }

    pub fn siguiente(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        (t ^ (t >> 14)) as f64 / 4294967296.0
    }
}
