import { type NextRequest, NextResponse } from "next/server"

let monitoringInterval: NodeJS.Timeout | null = null

interface MonitorConfig {
  workCardNumber: string
  nationalIdNumber: string
  emailTo: string
  emailFrom: string
  emailPassword: string
  smtpHost: string
  smtpPort: string
}

// VRAIE vérification du site ANEM
async function checkAppointmentAvailability(config: MonitorConfig) {
  try {
    console.log("🔍 Vérification RÉELLE du site ANEM...")
    console.log(`📋 Carte: ${config.workCardNumber}`)
    console.log(`🆔 ID: ${config.nationalIdNumber}`)

    // Validation des données
    if (!config.workCardNumber || config.workCardNumber.length < 8) {
      return {
        success: false,
        error: "Numéro de carte de travail invalide (minimum 8 caractères)",
        appointmentAvailable: false,
        timestamp: new Date().toISOString(),
        debugInfo: {
          validationError: "workCardNumber",
          providedLength: config.workCardNumber.length,
        },
      }
    }

    if (!config.nationalIdNumber || config.nationalIdNumber.length < 8) {
      return {
        success: false,
        error: "Numéro d'identification nationale invalide (minimum 8 caractères)",
        appointmentAvailable: false,
        timestamp: new Date().toISOString(),
        debugInfo: {
          validationError: "nationalIdNumber",
          providedLength: config.nationalIdNumber.length,
        },
      }
    }

    // Étape 1: Accéder à la page de pré-inscription
    console.log("🌐 Connexion au site ANEM...")
    const response = await fetch("https://minha.anem.dz/pre_inscription", {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,ar;q=0.7",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status} lors de l'accès au site ANEM`)
    }

    const html = await response.text()
    console.log(`✅ Page chargée (${html.length} caractères)`)

    // Extraire le token CSRF
    const csrfMatch = html.match(/name="_token"\s+value="([^"]+)"/)
    const csrfToken = csrfMatch ? csrfMatch[1] : null
    console.log(`🔐 Token CSRF: ${csrfToken ? "trouvé" : "non trouvé"}`)

    // Étape 2: Préparer et soumettre le formulaire
    const formData = new URLSearchParams()

    // Essayer différents noms de champs possibles
    const workCardFields = ["numero_carte_demandeur", "carte_travail", "work_card_number", "num_carte", "numero_carte"]

    const idFields = ["numero_identification_nationale", "id_national", "cin", "national_id", "numero_cin"]

    // Ajouter les données avec tous les noms possibles
    workCardFields.forEach((field) => {
      formData.append(field, config.workCardNumber)
    })

    idFields.forEach((field) => {
      formData.append(field, config.nationalIdNumber)
    })

    if (csrfToken) {
      formData.append("_token", csrfToken)
    }

    console.log("📤 Soumission du formulaire...")

    const submitResponse = await fetch("https://minha.anem.dz/pre_inscription", {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://minha.anem.dz/pre_inscription",
        Origin: "https://minha.anem.dz",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,ar;q=0.7",
      },
      body: formData.toString(),
      redirect: "follow",
    })

    const responseText = await submitResponse.text()
    console.log(`📄 Réponse reçue (${responseText.length} caractères)`)

    // Analyser la réponse
    const noAppointmentMessage = "نعتذر منكم ! لا يوجد أي موعد متاح حاليا"
    const appointmentAvailable = !responseText.includes(noAppointmentMessage)

    // Vérifier aussi d'autres indicateurs d'erreur
    const hasError =
      responseText.toLowerCase().includes("error") ||
      responseText.toLowerCase().includes("erreur") ||
      responseText.includes("خطأ") ||
      responseText.toLowerCase().includes("invalid") ||
      responseText.toLowerCase().includes("incorrect")

    if (hasError && !appointmentAvailable) {
      console.log("⚠️ Erreur détectée dans la réponse")
      return {
        success: false,
        error: "Données incorrectes ou problème avec le site ANEM",
        appointmentAvailable: false,
        timestamp: new Date().toISOString(),
        debugInfo: {
          finalUrl: submitResponse.url,
          statusCode: submitResponse.status,
          hasToken: !!csrfToken,
          responseLength: responseText.length,
          errorDetected: true,
        },
      }
    }

    console.log(`📊 Résultat: ${appointmentAvailable ? "RDV DISPONIBLE ✅" : "Aucun RDV ❌"}`)

    return {
      success: true,
      appointmentAvailable,
      timestamp: new Date().toISOString(),
      url: submitResponse.url || "https://minha.anem.dz/pre_rendez_vous",
      message: appointmentAvailable
        ? "🎉 Rendez-vous disponible sur le site ANEM!"
        : `❌ Aucun rendez-vous disponible (${noAppointmentMessage})`,
      debugInfo: {
        finalUrl: submitResponse.url,
        statusCode: submitResponse.status,
        hasToken: !!csrfToken,
        responseLength: responseText.length,
        foundNoAppointmentMessage: appointmentAvailable ? null : noAppointmentMessage,
      },
    }
  } catch (error) {
    console.error("❌ Erreur lors de la vérification ANEM:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de connexion au site ANEM",
      appointmentAvailable: false,
      timestamp: new Date().toISOString(),
      debugInfo: {
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : "Erreur inconnue",
      },
    }
  }
}

// Envoi d'email via Web3Forms
async function sendEmailNotification(config: MonitorConfig, appointmentAvailable: boolean) {
  try {
    if (!config.emailTo) {
      return { success: false, error: "Email de destination manquant" }
    }

    console.log("📧 Envoi d'email RÉEL...")

    const subject = appointmentAvailable
      ? "✅ ANEM - Rendez-vous disponible!"
      : "❌ ANEM - Aucun rendez-vous disponible"

    const message = appointmentAvailable
      ? `🎉 BONNE NOUVELLE !

Des rendez-vous sont maintenant DISPONIBLES sur le site ANEM.

🔗 Connectez-vous rapidement : https://minha.anem.dz/

⏰ Vérification effectuée le : ${new Date().toLocaleString("fr-FR")}

---
Moniteur ANEM - Surveillance automatique`
      : `❌ Aucun rendez-vous disponible

Le message "نعتذر منكم ! لا يوجد أي موعد متاح حاليا" est toujours présent sur le site ANEM.

La surveillance continue automatiquement...

⏰ Vérification effectuée le : ${new Date().toLocaleString("fr-FR")}

---
Moniteur ANEM - Surveillance automatique`

    // Vérifier si Web3Forms est configuré
    if (!process.env.WEB3FORMS_ACCESS_KEY) {
      console.log("⚠️ WEB3FORMS_ACCESS_KEY non configuré")
      return {
        success: false,
        error: "Web3Forms non configuré - ajoutez WEB3FORMS_ACCESS_KEY dans les variables d'environnement",
      }
    }

    // Utiliser Web3Forms
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_key: process.env.WEB3FORMS_ACCESS_KEY,
        subject: subject,
        email: config.emailTo,
        message: message,
        from_name: "Moniteur ANEM",
        to_name: "Utilisateur ANEM",
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log("✅ Email envoyé via Web3Forms")
      return {
        success: true,
        message: "Email envoyé avec succès",
        service: "Web3Forms",
        details: result,
      }
    } else {
      const errorText = await response.text()
      throw new Error(`Erreur Web3Forms: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.error("❌ Erreur envoi email:", error)

    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur email inconnue",
    }
  }
}

let lastAppointmentStatus: boolean | null = null

async function performCheck(config: MonitorConfig) {
  console.log("🔍 === VÉRIFICATION RÉELLE ANEM ===", new Date().toLocaleString("fr-FR"))

  try {
    const result = await checkAppointmentAvailability(config)

    if (result.success) {
      console.log(`📊 Résultat: ${result.appointmentAvailable ? "RDV DISPONIBLE ✅" : "Aucun RDV ❌"}`)

      // Envoyer email seulement si le statut a changé
      if (lastAppointmentStatus !== result.appointmentAvailable) {
        console.log("🔄 Changement de statut détecté, envoi d'email...")
        const emailResult = await sendEmailNotification(config, result.appointmentAvailable)
        lastAppointmentStatus = result.appointmentAvailable

        console.log(`📧 Email: ${emailResult.success ? "Envoyé ✅" : "Échec ❌"}`)
        if (!emailResult.success) {
          console.error("📧 Détails erreur email:", emailResult.error)
        }

        result.emailSent = emailResult.success
        result.emailError = emailResult.error
        result.emailMessage = emailResult.message
      } else {
        console.log("📊 Statut inchangé, pas d'email envoyé")
        result.emailSent = false
        result.emailError = "Statut inchangé, pas d'email envoyé"
      }
    } else {
      console.error("❌ Erreur lors de la vérification:", result.error)
    }

    return result
  } catch (error) {
    console.error("❌ Erreur dans performCheck:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
      appointmentAvailable: false,
      timestamp: new Date().toISOString(),
      emailSent: false,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, config } = body

    console.log(`🚀 API appelée - Action: ${action}`)

    switch (action) {
      case "start":
        try {
          if (monitoringInterval) {
            clearInterval(monitoringInterval)
          }

          if (!config?.workCardNumber || !config?.nationalIdNumber) {
            return NextResponse.json(
              {
                success: false,
                error: "Informations ANEM manquantes (numéro carte + ID national requis)",
              },
              { status: 400 },
            )
          }

          console.log("🎯 Démarrage du monitoring RÉEL...")
          const initialResult = await performCheck(config)

          // Vérifications toutes les 10 minutes
          monitoringInterval = setInterval(
            () => {
              performCheck(config).catch(console.error)
            },
            10 * 60 * 1000,
          )

          return NextResponse.json({
            success: true,
            message: "Monitoring RÉEL démarré - vérification toutes les 10 minutes",
            initialResult,
          })
        } catch (error) {
          console.error("❌ Erreur start:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Erreur lors du démarrage du monitoring",
            },
            { status: 500 },
          )
        }

      case "stop":
        try {
          if (monitoringInterval) {
            clearInterval(monitoringInterval)
            monitoringInterval = null
          }
          lastAppointmentStatus = null

          return NextResponse.json({
            success: true,
            message: "Monitoring arrêté",
          })
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: "Erreur lors de l'arrêt",
            },
            { status: 500 },
          )
        }

      case "check":
        try {
          if (!config?.workCardNumber || !config?.nationalIdNumber) {
            return NextResponse.json(
              {
                success: false,
                error: "Informations ANEM manquantes",
              },
              { status: 400 },
            )
          }

          const result = await performCheck(config)
          return NextResponse.json(result)
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: "Erreur lors de la vérification",
            },
            { status: 500 },
          )
        }

      case "test-email":
        try {
          if (!config?.emailTo) {
            return NextResponse.json(
              {
                success: false,
                error: "Email de destination manquant",
              },
              { status: 400 },
            )
          }

          const emailResult = await sendEmailNotification(config, true)
          return NextResponse.json(emailResult)
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: "Erreur lors du test email",
            },
            { status: 500 },
          )
        }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Action inconnue",
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("❌ Erreur API globale:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erreur serveur interne",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 },
    )
  }
}
