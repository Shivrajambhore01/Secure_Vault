"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "What is SecureVault?",
    answer:
      "SecureVault is a blockchain-based digital asset management and inheritance platform. It allows you to securely store your digital assets like passwords, documents, cryptocurrency keys, and legal files, and automatically transfer them to your trusted nominees upon prolonged inactivity.",
  },
  {
    question: "How does the inactivity detection work?",
    answer:
      "You set an inactivity period (3, 6, 12, or 24 months). If you do not log in or interact with the platform during that period, the system initiates a verification process. After verification, your digital assets are securely transferred to your assigned nominees via smart contracts.",
  },
  {
    question: "Is my data encrypted?",
    answer:
      "Yes. Every digital asset is encrypted with military-grade AES-256 encryption before being stored. Additionally, cryptographic hashes of your assets are stored on a blockchain to ensure tamper-proof integrity verification. Only you (with your PIN) can decrypt and view your assets.",
  },
  {
    question: "What happens if I lose my PIN?",
    answer:
      "Your PIN is a critical layer of security. If you lose it, you can reset it through a multi-step identity verification process that includes OTP verification via email and answering security questions. We recommend storing your PIN in a safe physical location as a backup.",
  },
  {
    question: "Can I assign multiple nominees?",
    answer:
      "Yes. You can add multiple nominees and assign specific digital assets to each nominee. Each nominee will only receive the assets specifically assigned to them. You can change assignments at any time from your dashboard.",
  },
  {
    question: "What types of digital assets can I store?",
    answer:
      "You can store documents (PDFs, DOCs), passwords and credentials, cryptocurrency private keys, images, and legal files. Each asset type is handled with appropriate encryption and storage methods. File uploads support up to 50MB per file.",
  },
  {
    question: "Is SecureVault free to use?",
    answer:
      "SecureVault offers a free tier that allows you to store up to 10 digital assets and assign 3 nominees. Premium plans with unlimited assets, priority support, and advanced features like multi-signature verification are available for power users.",
  },
  {
    question: "How does blockchain verification work?",
    answer:
      "When you upload an asset, a unique cryptographic hash (SHA-256) is generated and stored on the blockchain. This hash acts as a digital fingerprint. If anyone attempts to tamper with the asset, the hash mismatch is immediately detected, ensuring complete data integrity.",
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="relative px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            FAQ
          </p>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Everything you need to know about SecureVault and digital asset
            inheritance.
          </p>
        </div>

        <Accordion type="single" collapsible className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-xl border border-border bg-card px-6 data-[state=open]:border-primary/30"
            >
              <AccordionTrigger className="text-left text-base font-medium text-foreground hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
