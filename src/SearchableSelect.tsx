import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
type Option = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};
const text = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : isValidElement<{ children?: ReactNode }>(n)
          ? text(n.props.children)
          : "",
    )
    .join("");
function collect(children: ReactNode, group?: string): Option[] {
  return Children.toArray(children).flatMap((n) => {
    if (
      !isValidElement<{
        value?: string;
        children?: ReactNode;
        label?: string;
        disabled?: boolean;
      }>(n)
    )
      return [];
    if (n.type === "option") {
      const label = text(n.props.children);
      return [
        {
          value: String(n.props.value ?? label),
          label,
          group,
          disabled: n.props.disabled,
        },
      ];
    }
    return collect(
      n.props.children,
      n.type === "optgroup" ? n.props.label : group,
    );
  });
}
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(".", ",");
export default function SearchableSelect({
  children,
  value,
  onChange,
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [inheritedLabel, setInheritedLabel] = useState("");
  useLayoutEffect(() => {
    const label = root.current?.closest("label");
    if (label) {
      const name = Array.from(label.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(" ")
        .trim();
      setInheritedLabel(name);
    }
  });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const options = collect(children);
  const selected = options.find((o) => o.value === value && o.value !== "");
  const placeholder =
    options.find((o) => o.value === "")?.label ?? "Pesquise e selecione";
  const filtered = options.filter(
    (o) =>
      o.value !== "" &&
      normalize(o.label + " " + (o.group ?? "")).includes(normalize(query)),
  );
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected ? "Selecione uma opção da lista." : "",
    );
  }, [required, selected?.value]);
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      root.current
        ?.querySelector<HTMLElement>("[data-active=true]")
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);
  const choose = (o: Option) => {
    if (o.disabled) return;
    onChange({ target: { value: o.value } });
    setOpen(false);
    setQuery("");
    input.current?.focus();
  };
  return (
    <div className="search-select" ref={root}>
      <div className="search-select-control">
        <Search size={15} />
        <input
          ref={input}
          role="combobox"
          aria-label={ariaLabel ?? inheritedLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id}
          aria-activedescendant={
            open && filtered[active] ? id + "-" + active : undefined
          }
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={open ? query : (selected?.label ?? "")}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActive(0);
          }}
          onClick={() => {
            if (!open) {
              setOpen(true);
              setQuery("");
              setActive(0);
            }
          }}
          onBlur={(e) => {
            if (!root.current?.contains(e.relatedTarget)) setOpen(false);
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
            setActive(0);
            if (value && required) onChange({ target: { value: "" } });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) {
                setOpen(true);
                setQuery("");
                setActive(0);
              } else
                setActive((a) =>
                  Math.max(
                    0,
                    Math.min(
                      filtered.length - 1,
                      a + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (filtered[active]) choose(filtered[active]);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === "Tab") setOpen(false);
          }}
        />
        <ChevronDown size={15} />
      </div>
      {open && !disabled && (
        <div
          className="search-select-menu"
          id={id}
          role="listbox"
          aria-label={ariaLabel ?? "Opções"}
        >
          {filtered.length ? (
            filtered.map((o, i) => (
              <div key={o.value}>
                {o.group && o.group !== filtered[i - 1]?.group && (
                  <div className="search-select-group">{o.group}</div>
                )}
                <div
                  id={id + "-" + i}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  data-value={o.value}
                  data-active={active === i}
                  className={
                    "search-select-option" +
                    (active === i ? " highlighted" : "")
                  }
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                >
                  <span>{o.label}</span>
                  {o.value === value && <Check size={15} />}
                </div>
              </div>
            ))
          ) : (
            <p className="search-select-empty">Nenhuma opção encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
