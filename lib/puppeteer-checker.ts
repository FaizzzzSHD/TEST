import puppeteer from "puppeteer"

interface PuppeteerConfig {
  workCardNumber: string
  nationalIdNumber: string
}

export async function checkWithPuppeteer(config: PuppeteerConfig) {
  let browser = null

  try {
    console.log("🚀 Lancement de Puppeteer (navigateur réel)...")

    // Configuration Puppeteer pour Vercel
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    })

    const page = await browser.newPage()

    // Headers ultra-réalistes
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )

    await page.setExtraHTTPHeaders({
      "Accept-Language": "fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.7",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    })

    console.log("🌐 Navigation vers le site ANEM...")

    // Aller sur le site ANEM
    await page.goto("https://minha.anem.dz/pre_inscription", {
      waitUntil: "networkidle2",
      timeout: 30000,
    })

    // Attendre que la page se charge
    await page.waitForTimeout(3000)

    console.log("📄 Analyse de la page...")

    // Vérifier le contenu de la page
    const content = await page.content()
    const title = await page.title()

    console.log(`📊 Titre: ${title}`)
    console.log(`📄 Taille: ${content.length} caractères`)

    // Chercher les messages d'absence de RDV
    const noAppointmentMessages = [
      "نعتذر منكم ! لا يوجد أي موعد متاح حاليا",
      "aucun rendez-vous disponible",
      "pas de rendez-vous",
      "موعد غير متاح",
      "لا توجد مواعيد",
    ]

    let foundMessage = null
    for (const message of noAppointmentMessages) {
      if (content.toLowerCase().includes(message.toLowerCase())) {
        foundMessage = message
        break
      }
    }

    // Chercher le formulaire
    const hasForm = content.includes("<form") || content.includes("input")

    console.log(`📝 Formulaire trouvé: ${hasForm ? "OUI" : "NON"}`)
    console.log(`🔍 Message "pas de RDV": ${foundMessage ? "OUI" : "NON"}`)

    // Si on trouve un formulaire, essayer de le remplir
    if (hasForm && !foundMessage) {
      console.log("📝 Tentative de remplissage du formulaire...")

      try {
        // Chercher les champs de saisie
        const workCardInput = await page.$('input[name*="carte"], input[name*="work"], input[id*="carte"]')
        const nationalIdInput = await page.$('input[name*="national"], input[name*="id"], input[id*="national"]')

        if (workCardInput && nationalIdInput) {
          await workCardInput.type(config.workCardNumber)
          await nationalIdInput.type(config.nationalIdNumber)

          console.log("✅ Formulaire rempli")

          // Chercher le bouton submit
          const submitButton = await page.$('button[type="submit"], input[type="submit"]')
          if (submitButton) {
            console.log("🔘 Clic sur le bouton submit...")
            await submitButton.click()

            // Attendre la réponse
            await page.waitForTimeout(5000)

            const newContent = await page.content()
            console.log(`📄 Nouvelle taille: ${newContent.length} caractères`)

            // Vérifier le résultat
            for (const message of noAppointmentMessages) {
              if (newContent.toLowerCase().includes(message.toLowerCase())) {
                foundMessage = message
                break
              }
            }
          }
        }
      } catch (formError) {
        console.log(`⚠️ Erreur formulaire: ${formError}`)
      }
    }

    await browser.close()

    return {
      success: true,
      appointmentAvailable: !foundMessage,
      timestamp: new Date().toISOString(),
      url: "https://minha.anem.dz/pre_inscription",
      message: foundMessage
        ? `❌ Aucun rendez-vous disponible (${foundMessage}) - PUPPETEER RÉEL`
        : '🎉 Aucun message "pas de RDV" trouvé - Rendez-vous possiblement disponible! - PUPPETEER RÉEL',
      debugInfo: {
        method: "puppeteer_real_browser",
        finalUrl: page.url(),
        statusCode: 200,
        responseLength: content.length,
        foundNoAppointmentMessage: foundMessage,
        hasForm,
        title,
        isPuppeteer: true,
      },
    }
  } catch (error) {
    if (browser) {
      await browser.close()
    }

    console.error("❌ Erreur Puppeteer:", error)

    return {
      success: false,
      error: `Erreur Puppeteer: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      appointmentAvailable: false,
      timestamp: new Date().toISOString(),
      debugInfo: {
        method: "puppeteer_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
    }
  }
}
