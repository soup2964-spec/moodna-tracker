export const moodnaClerkAppearance = {
  layout: {
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
    logoPlacement: "none" as const,
  },
  variables: {
    colorPrimary: "#c9a818",
    colorText: "#171717",
    colorTextSecondary: "#737373",
    colorBackground: "#ffffff",
    colorInputBackground: "#fafafa",
    colorInputText: "#171717",
    colorNeutral: "#737373",
    borderRadius: "0.75rem",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    header: "hidden",
    rootBox: "w-full",
    cardBox: "w-full max-w-none shadow-none",
    card: "shadow-none border border-neutral-200 rounded-2xl bg-white px-2 py-4",
    headerTitle: "text-neutral-900 text-xl font-semibold tracking-tight",
    headerSubtitle: "text-neutral-500 text-sm",
    formButtonPrimary:
      "bg-[#e2c523] hover:bg-[#c9a818] text-neutral-900 font-semibold shadow-sm border-0",
    formFieldInput:
      "border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#c9a818] focus:ring-[#e2c523]/25",
    formFieldLabel: "text-neutral-700 font-medium",
    footerActionLink: "text-[#b89415] hover:text-[#9a7f10] font-medium",
    identityPreviewEditButton: "text-[#b89415]",
    dividerLine: "bg-neutral-200",
    dividerText: "text-neutral-400 text-xs",
    socialButtonsBlockButton:
      "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 font-medium",
    formFieldInputShowPasswordButton: "text-neutral-500",
    alert: "rounded-xl border border-neutral-200",
    footer: "bg-transparent",
    footerActionText: "text-neutral-500",
  },
}
