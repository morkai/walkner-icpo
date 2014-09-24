@echo off
nssm stop walkner-icpo
nssm remove walkner-icpo confirm
nssm install walkner-icpo "%CD%\node.exe" "backend\main.js" "%1"
nssm set walkner-icpo AppDirectory "%~dp0.."
nssm set walkner-icpo AppEnvironmentExtra "NODE_ENV=production"
nssm set walkner-icpo AppStdout "%CD%\..\logs\walkner-icpo.log"
nssm set walkner-icpo AppStderr "%CD%\..\logs\walkner-icpo.log"
nssm set walkner-icpo Description "Aplikacja wspomagajaca proces programowania sterownikow CityTouch."
nssm set walkner-icpo DisplayName "Walkner ICPO"
nssm set walkner-icpo Start SERVICE_AUTO_START
nssm set walkner-icpo AppRotateFiles 1
nssm set walkner-icpo AppRotateBytes 5242880

if not "%2"=="" (
  ntrights +r SeServiceLogonRight -u "%2"

  if not "%3"=="" (
    sc config walkner-icpo obj= "%2" password= "%3"
  ) else (
    sc config walkner-icpo obj= "%2"
  )
)
