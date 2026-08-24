-- SIRRO Regla de Oro: identidad/DNI y celular no pueden corresponder a personas distintas.
-- El DNI puede aparecer en múltiples referencias únicamente porque pertenecen a la misma persona.

CREATE OR REPLACE FUNCTION public.sirro_solo_digitos(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO ''
AS $$
  SELECT regexp_replace(coalesce(p_valor,''), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.sirro_validar_regla_oro_persona()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_dni text;
  v_tel text;
  v_conflicto boolean;
BEGIN
  IF TG_TABLE_NAME = 'perfiles' THEN
    v_dni := public.sirro_solo_digitos(NEW.identidad);
    v_tel := public.sirro_solo_digitos(NEW.telefono);

    IF v_dni = '' THEN
      RAISE EXCEPTION 'REGLA DE ORO SIRRO: la identidad/DNI es obligatoria';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id <> NEW.id
        AND public.sirro_solo_digitos(p.identidad) = v_dni
    ) INTO v_conflicto;
    IF v_conflicto THEN
      RAISE EXCEPTION 'REGLA DE ORO SIRRO: este DNI ya pertenece a un usuario existente. Utilice o actualice el registro de la misma persona';
    END IF;

    IF v_tel <> '' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.perfiles p
         WHERE p.id <> NEW.id
           AND public.sirro_solo_digitos(p.telefono) = v_tel
           AND public.sirro_solo_digitos(p.identidad) <> v_dni
        UNION ALL
        SELECT 1 FROM public.casos_referencia c
         WHERE public.sirro_solo_digitos(c.paciente_contacto) = v_tel
           AND public.sirro_solo_digitos(c.paciente_identidad) <> v_dni
      ) INTO v_conflicto;
      IF v_conflicto THEN
        RAISE EXCEPTION 'REGLA DE ORO SIRRO: este número de celular ya está asociado a otra persona. Verifique antes de continuar';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'casos_referencia' THEN
    v_dni := public.sirro_solo_digitos(NEW.paciente_identidad);
    v_tel := public.sirro_solo_digitos(NEW.paciente_contacto);

    IF v_dni = '' THEN
      RAISE EXCEPTION 'REGLA DE ORO SIRRO: la identidad/DNI del paciente es obligatoria';
    END IF;

    IF v_tel <> '' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.perfiles p
         WHERE public.sirro_solo_digitos(p.telefono) = v_tel
           AND public.sirro_solo_digitos(p.identidad) <> v_dni
        UNION ALL
        SELECT 1 FROM public.casos_referencia c
         WHERE c.id <> NEW.id
           AND public.sirro_solo_digitos(c.paciente_contacto) = v_tel
           AND public.sirro_solo_digitos(c.paciente_identidad) <> v_dni
      ) INTO v_conflicto;
      IF v_conflicto THEN
        RAISE EXCEPTION 'REGLA DE ORO SIRRO: este número de celular ya está asociado a otra persona. Verifique antes de continuar';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regla_oro_perfiles ON public.perfiles;
CREATE TRIGGER trg_regla_oro_perfiles
BEFORE INSERT OR UPDATE OF identidad, telefono ON public.perfiles
FOR EACH ROW EXECUTE FUNCTION public.sirro_validar_regla_oro_persona();

DROP TRIGGER IF EXISTS trg_regla_oro_casos ON public.casos_referencia;
CREATE TRIGGER trg_regla_oro_casos
BEFORE INSERT OR UPDATE OF paciente_identidad, paciente_contacto ON public.casos_referencia
FOR EACH ROW EXECUTE FUNCTION public.sirro_validar_regla_oro_persona();

CREATE UNIQUE INDEX IF NOT EXISTS ux_perfiles_identidad_normalizada
ON public.perfiles (public.sirro_solo_digitos(identidad));
CREATE INDEX IF NOT EXISTS ix_perfiles_telefono_normalizado
ON public.perfiles (public.sirro_solo_digitos(telefono));
CREATE INDEX IF NOT EXISTS ix_casos_identidad_normalizada
ON public.casos_referencia (public.sirro_solo_digitos(paciente_identidad));
CREATE INDEX IF NOT EXISTS ix_casos_telefono_normalizado
ON public.casos_referencia (public.sirro_solo_digitos(paciente_contacto));

REVOKE EXECUTE ON FUNCTION public.sirro_validar_regla_oro_persona() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sirro_solo_digitos(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sirro_solo_digitos(text) TO authenticated;
