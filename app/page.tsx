"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Clock, TestTube, Zap, Globe, AlertTriangle, Bot } from "lucide-react"
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
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null)
  const [usePuppeteer, setUsePuppeteer] = useState(false)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleString("fr-FR")
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)])
  }

  const handleTestEmail = async () => {
    if (!config.emailTo) {
      addLog("❌ Veuillez remplir l'email de destination pour le test")
      return
    }

    addLog("📧 Test d'envoi d'email en cours...")
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
        setEmailConfigured(true)
      } else {
        addLog(`⚠️ Test email: ${result.error}`)
        if (result.canContinue) {
          addLog("💡 Le système peut fonctionner sans email")
          addLog("🔧 Configurez Web3Forms pour activer les notifications")
        }
        setEmailConfigured(false)
      }
    } catch (error) {
      addLog("❌ Erreur lors du test email")
      addLog(`🔍 Détails: ${error instanceof Error ? error.message : "Erreur inconnue"}`)
      setEmailConfigured(false)
    }
  }

  const handleStart = async () => {
    if (!config.workCardNumber || !config.nationalIdNumber) {
      addLog("❌ Veuillez remplir au minimum les informations ANEM")
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
    addLog(
      `🚀 Démarrage du monitoring ANEM ${usePuppeteer ? "avec Puppeteer (navigateur réel)" : "en mode standard"}...`,
    )

    try {
      const response = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", config, usePuppeteer }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        addLog(`❌ Erreur HTTP ${response.status}: ${errorText}`)
        setIsRunning(false)
        return
      }

      const result = await response.json()

      if (result.success) {
        addLog("✅ Monitoring démarré avec succès")
        addLog("🔄 Vérification automatique toutes les 10 minutes")
        addLog(`🎯 Mode: ${usePuppeteer ? "Puppeteer (navigateur réel)" : "Standard (avec fallback simulation)"}`)

        setEmailConfigured(result.emailConfigured)

        if (result.emailConfigured) {
          addLog("📧 Notifications email activées")
        } else {
          addLog("⚠️ Surveillance SANS email (configurez Web3Forms pour les notifications)")
        }

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
          }

          if (initial.debugInfo) {
            addLog(`🔍 URL finale: ${initial.debugInfo.finalUrl || "N/A"}`)
            addLog(`📊 Status HTTP: ${initial.debugInfo.statusCode || "N/A"}`)
            addLog(`🔐 Token CSRF: ${initial.debugInfo.hasToken ? "Trouvé" : "Non trouvé"}`)
            addLog(`📄 Méthode: ${initial.debugInfo.method || initial.debugInfo.mode || "N/A"}`)

            if (initial.debugInfo.isPuppeteer) {
              addLog("🤖 Méthode: PUPPETEER (navigateur réel)")
            } else if (initial.debugInfo.isFetch) {
              addLog("🌐 Méthode: FETCH (requête HTTP)")
            } else if (initial.debugInfo.mode === "simulation") {
              addLog("🎭 Méthode: SIMULATION (site bloque les bots)")
            }
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

    addLog(`🔍 Vérification ${usePuppeteer ? "avec Puppeteer (navigateur réel)" : "en mode standard"} en cours...`)

    try {
      const response = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", config, usePuppeteer }),
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

          if (result.debugInfo.isPuppeteer) {
            addLog("🤖 Méthode utilisée: PUPPETEER (navigateur réel)")
            if (result.debugInfo.title) {
              addLog(`📄 Titre de la page: ${result.debugInfo.title}`)
            }
          } else if (result.debugInfo.isFetch) {
            addLog("🌐 Méthode utilisée: FETCH (requête HTTP)")
          } else if (result.debugInfo.mode === "simulation") {
            addLog("🎭 Méthode utilisée: SIMULATION (site bloque les bots)")
          }

          if (result.debugInfo.foundNoAppointmentMessage) {
            addLog(`🔍 Message trouvé: ${result.debugInfo.foundNoAppointmentMessage}`)
          }
        }

        if (result.emailSent === true) {
          addLog("📧 Email de notification envoyé avec succès")
        } else if (result.emailMessage) {
          addLog(`📧 ${result.emailMessage}`)
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
          Moniteur ANEM - Version Avancée
        </h1>
        <p className="text-muted-foreground">
          Surveillance automatique avec Puppeteer (navigateur réel) et fallback intelligent
        </p>
      </div>

      <Alert className="mb-6 border-green-200 bg-green-50">
        <Bot className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Nouvelle version avec Puppeteer :</strong> Utilise un vrai navigateur pour contourner les protections
          anti-bot du site ANEM. Fallback automatique vers simulation si nécessaire.
        </AlertDescription>
      </Alert>

      {emailConfigured === false && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Emails non configurés :</strong> Le système surveille mais n'enverra pas d'emails. Configurez
            Web3Forms pour activer les notifications.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>Informations ANEM (obligatoires) et options avancées</CardDescription>
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
              <Label htmlFor="emailTo">Email de notification (optionnel)</Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="votre@email.com (optionnel)"
                value={config.emailTo}
                onChange={(e) => setConfig((prev) => ({ ...prev, emailTo: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="puppeteer"
                checked={usePuppeteer}
                onChange={(e) => setUsePuppeteer(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="puppeteer" className="text-sm">
                🤖 Utiliser Puppeteer (navigateur réel) - RECOMMANDÉ
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Puppeteer simule un vrai navigateur pour contourner les protections anti-bot
            </p>

            <Button onClick={handleTestEmail} variant="outline" className="w-full bg-transparent">
              <TestTube className="h-4 w-4 mr-2" />
              Tester l'email (optionnel)
            </Button>

            <div className="flex gap-2">
              <Button onClick={handleStart} disabled={isRunning} className="flex-1">
                {isRunning ? "🔄 En cours..." : usePuppeteer ? "🤖 Démarrer (Puppeteer)" : "🚀 Démarrer (Standard)"}
              </Button>
              <Button onClick={handleStop} disabled={!isRunning} variant="outline" className="flex-1 bg-transparent">
                ⏹️ Arrêter
              </Button>
            </div>

            <Button onClick={handleCheckNow} variant="secondary" className="w-full">
              {usePuppeteer ? "🤖 Vérifier avec Puppeteer" : "🔍 Vérifier maintenant"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Statut - Version Avancée
            </CardTitle>
            <CardDescription>État actuel de la surveillance ANEM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>État:</span>
              <Badge variant={isRunning ? "default" : "secondary"}>
                {isRunning ? (usePuppeteer ? "🤖 Actif (Puppeteer)" : "🔄 Actif (Standard)") : "⏸️ Inactif"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Mode:</span>
              <Badge variant={usePuppeteer ? "default" : "secondary"}>
                {usePuppeteer ? "🤖 Puppeteer" : "🌐 Standard"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Emails:</span>
              <Badge
                variant={emailConfigured === true ? "default" : emailConfigured === false ? "destructive" : "secondary"}
              >
                {emailConfigured === true
                  ? "✅ Configurés"
                  : emailConfigured === false
                    ? "❌ Non configurés"
                    : "❓ Inconnu"}
              </Badge>
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
              <Label>Logs de surveillance avancée:</Label>
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
          <CardTitle>🤖 Puppeteer - La Solution Avancée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            1. <strong>Navigateur réel :</strong> Puppeteer lance un vrai navigateur Chrome pour contourner les
            protections
          </p>
          <p>
            2. <strong>JavaScript activé :</strong> Exécute le JavaScript comme un utilisateur normal
          </p>
          <p>
            3. <strong>Remplissage de formulaire :</strong> Peut saisir vos informations dans le formulaire ANEM
          </p>
          <p>
            4. <strong>Fallback intelligent :</strong> Si Puppeteer échoue, retombe sur fetch puis simulation
          </p>
          <p>
            5. <strong>Plus lent mais plus efficace :</strong> Prend 10-30 secondes mais contourne les blocages
          </p>
          <p className="text-green-600 font-medium">
            ✅ <strong>Recommandé :</strong> Cochez "Utiliser Puppeteer" pour de meilleurs résultats !
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>📊 Comparaison des Méthodes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded p-3">
              <h4 className="font-semibold text-green-600">🤖 Puppeteer</h4>
              <p>✅ Navigateur réel</p>
              <p>✅ Contourne les protections</p>
              <p>✅ JavaScript activé</p>
              <p>⚠️ Plus lent (10-30s)</p>
            </div>
            <div className="border rounded p-3">
              <h4 className="font-semibold text-blue-600">🌐 Fetch Standard</h4>
              <p>✅ Rapide (2-5s)</p>
              <p>✅ Léger</p>
              <p>❌ Souvent bloqué</p>
              <p>❌ Pas de JavaScript</p>
            </div>
            <div className="border rounded p-3">
              <h4 className="font-semibold text-orange-600">🎭 Simulation</h4>
              <p>✅ Toujours fonctionne</p>
              <p>✅ Très rapide</p>
              <p>✅ Réaliste (95% pas de RDV)</p>
              <p>⚠️ Pas de vraie vérification</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
