import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

// Etiketin ait olduğu kontrol: aynı alan sarmalayıcısında etiketten sonra gelen ilk girdi.
const CONTROL_SELECTOR =
  "input:not([type=hidden]),select,textarea,button[role=combobox],[role=switch],[role=checkbox]"

/**
 * Etiketi ilgili girdiyle eşleştirir (htmlFor). Açık bir htmlFor verilmişse ona dokunmaz.
 * Böylece ekran okuyucular ve erişilebilirlik testleri etiketi alanla ilişkilendirir.
 */
function useLinkedControl(labelRef, htmlFor) {
  const uid = React.useId().replace(/:/g, "")
  const [target, setTarget] = React.useState(null)

  React.useLayoutEffect(() => {
    if (htmlFor) return
    const label = labelRef.current
    const scope = label?.parentElement
    if (!label || !scope) return
    const control = Array.from(scope.querySelectorAll(CONTROL_SELECTOR)).find(
      (el) => label.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
    )
    if (!control) {
      setTarget(null)
      return
    }
    if (!control.id) control.id = `fld-${uid}`
    setTarget(control.id)
  })

  return htmlFor ?? target ?? undefined
}

const Label = React.forwardRef(({ className, htmlFor, ...props }, forwardedRef) => {
  const innerRef = React.useRef(null)
  const setRefs = React.useCallback(
    (node) => {
      innerRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )
  const linked = useLinkedControl(innerRef, htmlFor)
  return (
    <LabelPrimitive.Root
      ref={setRefs}
      htmlFor={linked}
      className={cn("text-[13px] font-medium leading-none text-slate-600 peer-disabled:opacity-70", className)}
      {...props}
    />
  )
})
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
