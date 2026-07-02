-- Habilitar extensión pgcrypto para UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum para estados de la zona
CREATE TYPE estado_zona AS ENUM ('estable', 'alerta', 'crítico');

-- Enum para tipos de recursos
CREATE TYPE tipo_recurso AS ENUM ('agua', 'alimentos', 'medicamentos', 'herramientas');

-- Enum para tipos de reportes ciudadanos
CREATE TYPE tipo_reporte AS ENUM ('alerta_daño', 'oferta_donacion');

-- Enum para estado del reporte
CREATE TYPE estado_reporte AS ENUM ('pendiente', 'atendido', 'descartado');

-- ==========================================
-- TABLA: zonas
-- ==========================================
CREATE TABLE zonas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_zona VARCHAR(255) NOT NULL,
    estado estado_zona DEFAULT 'estable',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- TABLA: inventario
-- ==========================================
CREATE TABLE inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona_id UUID REFERENCES zonas(id) ON DELETE CASCADE,
    tipo tipo_recurso NOT NULL,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(zona_id, tipo)
);

-- ==========================================
-- TABLA: reportes_ciudadanos
-- ==========================================
CREATE TABLE reportes_ciudadanos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona_id UUID REFERENCES zonas(id) ON DELETE CASCADE,
    tipo tipo_reporte NOT NULL,
    descripcion TEXT NOT NULL,
    numero_telefono VARCHAR(20) NOT NULL, -- Obligatorio y Sensible
    estado estado_reporte DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- SEGURIDAD: Habilitar RLS (Row Level Security)
-- ==========================================
ALTER TABLE zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_ciudadanos ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLÍTICAS: zonas
-- ==========================================
-- Todos pueden ver las zonas (Público, líderes, admin)
CREATE POLICY "Zonas son de lectura pública" ON zonas
    FOR SELECT USING (true);

-- ==========================================
-- POLÍTICAS: inventario
-- ==========================================
-- Todos pueden ver el inventario
CREATE POLICY "Inventario es de lectura pública" ON inventario
    FOR SELECT USING (true);

-- Solo los líderes de su propia zona o super admin pueden actualizar
CREATE POLICY "Líderes de zona y Admin pueden actualizar inventario" ON inventario
    FOR UPDATE USING (
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin') OR
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'zone_leader' AND auth.jwt() -> 'app_metadata' ->> 'zona_id' = zona_id::text)
    );

-- ==========================================
-- POLÍTICAS: reportes_ciudadanos
-- ==========================================
-- Público puede insertar reportes
CREATE POLICY "Cualquiera puede crear reportes" ON reportes_ciudadanos
    FOR INSERT WITH CHECK (true);

-- Ocultamiento condicional de numero_telefono
-- Para lograr que SOLO super_admin y el zone_leader respectivo puedan VER el numero_telefono, 
-- utilizaremos una vista segura, pero Supabase RLS aplica a nivel de fila.
-- Como queremos que los datos de la fila estén ocultos en ciertos campos o filas completas:

-- 1. Un usuario público no debe poder hacer SELECT a ningún reporte (privacidad total).
-- 2. El super_admin puede ver TODOS los reportes.
-- 3. El zone_leader solo puede ver los reportes de su zona.
CREATE POLICY "Admins ven todos los reportes" ON reportes_ciudadanos
    FOR SELECT USING (
        auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin'
    );

CREATE POLICY "Líderes ven reportes de su zona" ON reportes_ciudadanos
    FOR SELECT USING (
        auth.jwt() -> 'app_metadata' ->> 'role' = 'zone_leader' AND 
        auth.jwt() -> 'app_metadata' ->> 'zona_id' = zona_id::text
    );

-- Notas de inserción inicial (Seeds)
INSERT INTO zonas (nombre_zona, estado) VALUES
('Zona 1', 'estable'),
('Zona 2', 'estable'),
('Zona 3', 'alerta'),
('Zona 4', 'estable'),
('Zona 5', 'crítico'),
('Zona 6', 'estable');
