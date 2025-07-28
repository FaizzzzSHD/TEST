"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Clock, TestTube, Zap, Globe, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ANEMMonitor() {
  const [config, setConfig] = useState({
    workCardNumber: "",
    nationalIdNumber: "",
    emailTo: "",
    emailFrom: "",
    emailPassword: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
  })
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [lastCheck, setLastCheck] = useState<string>("")
  const [appointmentStatus, setAppointmentStatus] = useState<"available" | "unavailable" | "unknown">("unknown")

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleString("fr-FR")
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)])
  }

  const handleTestEmail = async () => {
    if (!config.emailTo) {
      addLog("❌ Veuillez remplir l'email de destination pour le test")
      return
    }

    addLog("📧 Test d'envoi d'email RÉEL en cours...")
    try {
      const response = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-email", config }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        addLog(`❌ Erreur HTTP ${response.status}: ${errorText}`)
        return
      }

      const result = await response.json()
      if (result.success) {
        addLog("✅ Email de test envoyé avec succès!")
        addLog(`📬 ${result.message}`)
        if (result.service) {
          addLog(`📧 Service: ${result.service}`)
        }
      } else {
        addLog(`❌ Échec du test email: ${result.error}`)
        if (result.error.includes("WEB3FORMS_ACCESS_KEY")) {
          addLog("💡 Configurez Web3Forms dans les variables d'environnement Vercel")
        }
      }
    } catch (error) {
      addLog("❌ Erreur lors du test email")
      addLog(`🔍 Détails: ${error instanceof Error ? error.message : "Erreur inconnue"}`)
    }
  }

  const handleStart = async () => {
    if (!config.workCardNumber || !config.nationalIdNumber || !config.emailTo) {
      addLog("❌ Veuillez remplir tous les champs obligatoires")
      return
    }

    if (config.workCardNumber.length < 8) {
      addLog("❌ Le numéro de carte doit contenir au moins 8 caractères")
      return
    }

    if (config.nationalIdNumber.length < 8) {
      addLog("❌ Le numéro d'identification doit contenir au moins 8 caractères")
      return
    }

    setIsRunning(true)
    addLog("🚀 Démarrage du monitoring RÉEL du site ANEM...")

    try {
      const response = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", config }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        addLog(`❌ Erreur HTTP ${response.status}: ${errorText}`)
        setIsRunning(false)
        return
      }

      const result = await response.json()

      if (result.success) {
        addLog("✅ Monitoring RÉEL démarré avec succès")
        addLog("🔄 Vérification automatique toutes les 10 minutes")
        addLog("🌐 Connexion directe au site ANEM officiel")

        if (result.initialResult) {
          const initial = result.initialResult
          addLog(`🎯 Première vérification: ${initial.appointmentAvailable ? "RDV DISPONIBLE ✅" : "Aucun RDV ❌"}`)

          if (initial.message) {
            addLog(`💬 ${initial.message}`)
          }

          if (initial.emailSent === true) {
            addLog("📧 Email de notification envoyé")
          } else if (initial.emailMessage) {
            addLog(`📧 ${initial.emailMessage}`)
          } else if (initial.emailError) {
            addLog(`📧 ${initial.emailError}`)
          }

          if (initial.debugInfo) {
            addLog(`🔍 URL finale: ${initial.debugInfo.finalUrl || "N/A"}`)
            addLog(`📊 Status HTTP: ${initial.debugInfo.statusCode || "N/A"}`)
            addLog(`🔐 Token CSRF: ${initial.debugInfo.hasToken ? "Trouvé" : "Non trouvé"}`)
          }

          setAppointmentStatus(initial.appointmentAvailable ? "available" : "unavailable")
          setLastCheck(new Date().toLocaleString("fr-FR"))
        }
      } else {
        addLog(`❌ Erreur: ${result.error}`)
        setIsRunning(false)
      }
    } catch (error) {
      addLog("❌ Erreur de connexion")
      addLog(`🔍 Détails: ${error instanceof Error ? error.message : "Erreur inconnue"}`)
      setIsRunning(false)
    }
  }

  const handleStop = async () => {
    try {
      await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      })
      setIsRunning(false)
      addLog("⏹️ Monitoring arrêté")
    } catch (error) {
      addLog("❌ Erreur lors de l'arrêt")
    }
  }

  const handleCheckNow = async () => {
    if (!config.workCardNumber || !config.nationalIdNumber) {
      addLog("❌ Veuillez remplir les informations ANEM")
      return
    }

    addLog("🔍 Vérification RÉELLE en cours...")
    addLog("🌐 Connexion au site ANEM officiel...")

    try {
      const response = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", config }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        addLog(`❌ Erreur HTTP ${response.status}: ${errorText}`)
        return
      }

      const result = await response.json()

      if (result.success) {
        setAppointmentStatus(result.appointmentAvailable ? "available" : "unavailable")
        setLastCheck(new Date().toLocaleString("fr-FR"))

        addLog(result.appointmentAvailable ? "🎉 RENDEZ-VOUS DISPONIBLE!" : "❌ Aucun rendez-vous disponible")

        if (result.message) {
          addLog(`💬 ${result.message}`)
        }

        if (result.debugInfo) {
          addLog(`🔍 URL finale: ${result.debugInfo.finalUrl || "N/A"}`)
          addLog(`📊 Status HTTP: ${result.debugInfo.statusCode || "N/A"}`)
          addLog(`🔐 Token CSRF: ${result.debugInfo.hasToken ? "Trouvé" : "Non trouvé"}`)
          addLog(`📄 Taille réponse: ${result.debugInfo.responseLength || 0} caractères`)

          if (result.debugInfo.foundNoAppointmentMessage) {
            addLog(`🔍 Message trouvé: ${result.debugInfo.foundNoAppointmentMessage}`)
          }
        }

        if (result.emailSent === true) {
          addLog("📧 Email de notification envoyé avec succès")
        } else if (result.emailSent === false && result.emailError) {
          addLog(`📧 ${result.emailError}`)
        }

        if (result.url) {
          addLog(`📍 URL vérifiée: ${result.url}`)
        }
      } else {
        addLog(`❌ Erreur: ${result.error}`)
        if (result.debugInfo) {
          addLog(`🔍 Type d'erreur: ${result.debugInfo.errorType || "N/A"}`)
          if (result.debugInfo.validationError) {
            addLog(`⚠️ Problème de validation: ${result.debugInfo.validationError}`)
            addLog(`📏 Longueur fournie: ${result.debugInfo.providedLength || 0}`)
          }
        }
      }
    } catch (error) {
      addLog("❌ Erreur de connexion au serveur")
      addLog(`🔍 Détails: ${error instanceof Error ? error.message : "Erreur inconnue"}`)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Zap className="h-8 w-8 text-green-500" />
          Moniteur ANEM RÉEL
        </h1>
        <p className="text-muted-foreground">
          Surveillance automatique RÉELLE des rendez-vous sur le site ANEM officiel
        </p>
      </div>

      <Alert className="mb-6 border-green-200 bg-green-50">
        <Shield className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Mode RÉEL activé :</strong> Ce système vérifie vraiment le site ANEM et envoie de vrais emails.
          Configurez Web3Forms pour activer les notifications email.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuration RÉELLE
            </CardTitle>
            <CardDescription>Vos vraies informations ANEM pour la vérification automatique</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workCard">رقم بطاقة طالب العمل * (minimum 8 caractères)</Label>
              <Input
                id="workCard"
                placeholder="Ex: 250199032670"
                value={config.workCardNumber}
                onChange={(e) => setConfig((prev) => ({ ...prev, workCardNumber: e.target.value }))}
                className="font-mono"
              />
              {config.workCardNumber && config.workCardNumber.length < 8 && (
                <p className="text-sm text-red-500">⚠️ Minimum 8 caractères requis</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationalId">رقم التعريف الوطني * (minimum 8 caractères)</Label>
              <Input
                id="nationalId"
                placeholder="Votre vrai numéro d'identification"
                value={config.nationalIdNumber}
                onChange={(e) => setConfig((prev) => ({ ...prev, nationalIdNumber: e.target.value }))}
                className="font-mono"
              />
              {config.nationalIdNumber && config.nationalIdNumber.length < 8 && (
                <p className="text-sm text-red-500">⚠️ Minimum 8 caractères requis</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailTo">Email de notification * (RÉEL)</Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="votre@email.com"
                value={config.emailTo}
                onChange={(e) => setConfig((prev) => ({ ...prev, emailTo: e.target.value }))}
              />
            </div>

            <Button onClick={handleTestEmail} variant="outline" className="w-full bg-transparent">
              <TestTube className="h-4 w-4 mr-2" />
              Tester l'email RÉEL
            </Button>

            <div className="flex gap-2">
              <Button onClick={handleStart} disabled={isRunning} className="flex-1">
                {isRunning ? "🔄 En cours..." : "🚀 Démarrer RÉEL"}
              </Button>
              <Button onClick={handleStop} disabled={!isRunning} variant="outline" className="flex-1 bg-transparent">
                ⏹️ Arrêter
              </Button>
            </div>

            <Button onClick={handleCheckNow} variant="secondary" className="w-full">
              🔍 Vérifier maintenant (RÉEL)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Statut RÉEL
            </CardTitle>
            <CardDescription>État actuel de la surveillance du site ANEM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>État:</span>
              <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "🔄 Actif (RÉEL)" : "⏸️ Inactif"}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Dernière vérification:</span>
              <span className="text-sm text-muted-foreground">{lastCheck || "Jamais"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Rendez-vous:</span>
              <div className="flex items-center gap-2">
                {appointmentStatus === "available" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="default" className="bg-green-500">
                      🎉 Disponible
                    </Badge>
                  </>
                )}
                {appointmentStatus === "unavailable" && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">❌ Indisponible</Badge>
                  </>
                )}
                {appointmentStatus === "unknown" && <Badge variant="secondary">❓ Inconnu</Badge>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logs de vérification RÉELLE:</Label>
              <div className="bg-muted rounded-md p-3 h-48 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Cliquez sur "Vérifier maintenant" pour commencer</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-xs font-mono mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🎯 Instructions - Mode RÉEL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            1. <strong>Entrez vos VRAIES informations ANEM</strong> (numéro de carte de demandeur d'emploi et numéro
            d'identification nationale)
          </p>
          <p>
            2. <strong>Configurez Web3Forms</strong> en ajoutant votre clé dans les variables d'environnement Vercel
          </p>
          <p>
            3. <strong>Testez d'abord</strong> avec "Vérifier maintenant" pour voir si vos informations sont correctes
          </p>
          <p>
            4. <strong>Démarrez le monitoring</strong> pour une surveillance automatique toutes les 10 minutes
          </p>
          <p>
            5. <strong>Vous recevrez un email</strong> à chaque changement de statut des rendez-vous
          </p>
          <p className="text-green-600 font-medium">
            ✅ <strong>Important :</strong> Utilisez vos vraies informations ANEM pour que la vérification fonctionne.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>⚙️ Configuration Web3Forms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            1. <strong>Allez sur</strong>{" "}
            <a href="https://web3forms.com" target="_blank" className="text-blue-600 underline" rel="noreferrer">
              web3forms.com
            </a>
          </p>
          <p>
            2. <strong>Créez un compte gratuit</strong> et obtenez votre Access Key
          </p>
          <p>
            3. <strong>Dans Vercel Dashboard</strong> → Settings → Environment Variables
          </p>
          <p>
            4. <strong>Ajoutez :</strong>{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">WEB3FORMS_ACCESS_KEY = votre_clé</code>
          </p>
          <p>
            5. <strong>Redéployez</strong> votre application pour appliquer les changements
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
