; Native dark controls and real NSIS instruction progress. No synthetic timer increments.
LangString PapierWelcome ${LANG_ENGLISH} "Your private workspace for PDF.$\r$\n$\r$\nEdit with precision. Organize pages. Sign and export.$\r$\n$\r$\nThe editor, fonts and PDF tools run on your computer. No account is required.$\r$\n$\r$\nChoose Next to prepare your workspace."
LangString PapierWelcome ${LANG_PORTUGUESEBR} "Seu espaço privado para PDF.$\r$\n$\r$\nEdite com precisão. Organize páginas. Assine e exporte.$\r$\n$\r$\nO editor, as fontes e as ferramentas PDF funcionam no seu computador. Sem conta obrigatória.$\r$\n$\r$\nClique em Próximo para preparar seu espaço."
LangString PapierReady ${LANG_ENGLISH} "Your workspace is ready."
LangString PapierReady ${LANG_PORTUGUESEBR} "Seu espaço está pronto."
LangString PapierFinished ${LANG_ENGLISH} "Papier was installed successfully.$\r$\n$\r$\nOpen a PDF or start with an editable template. Your documents stay on your computer."
LangString PapierFinished ${LANG_PORTUGUESEBR} "Papier foi instalado com sucesso.$\r$\n$\r$\nAbra um PDF ou comece com um modelo editável. Seus documentos ficam no seu computador."
LangString PapierInstalling ${LANG_ENGLISH} "Installing Papier"
LangString PapierInstalling ${LANG_PORTUGUESEBR} "Instalando Papier"
Var PapierPercent
Var PapierProgressHigh
Var PapierProgressActive
Var PapierHeaderFont

!macro PapierThemeFunction Prefix
Function ${Prefix}PapierGuiInit
  SetCtlColors $HWNDPARENT E8EFFB 0D1118
  GetDlgItem $2 $HWNDPARENT 1035
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1045
  ShowWindow $2 0
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
  Call ${Prefix}PapierPageShow
FunctionEnd
Function ${Prefix}PapierPageShow
  Push $0
  Push $1
  Push $2
  Push $3
  SetCtlColors $HWNDPARENT E8EFFB 0D1118
  System::Call 'user32::GetWindow(p $HWNDPARENT,i 5)p.r0'
  ${DoWhile} $0 <> 0
    SetCtlColors $0 E8EFFB 0D1118
    System::Call 'uxtheme::SetWindowTheme(p r0,w "DarkMode_Explorer",p 0)'
    System::Call 'user32::GetWindow(p r0,i 5)p.r1'
    ${DoWhile} $1 <> 0
      SetCtlColors $1 E8EFFB 0D1118
      System::Call 'uxtheme::SetWindowTheme(p r1,w "DarkMode_Explorer",p 0)'
      ; Radio/check labels must use our text color, not the light-theme Button renderer.
      System::Call 'user32::GetClassName(p r1,w.r2,i ${NSIS_MAX_STRLEN})'
      ${If} $2 == "Button"
        System::Call 'user32::GetWindowLong(p r1,i -16)i.r3'
        IntOp $3 $3 & 0xF
        ${If} $3 == 2
        ${OrIf} $3 == 3
        ${OrIf} $3 == 4
        ${OrIf} $3 == 5
        ${OrIf} $3 == 6
        ${OrIf} $3 == 9
          System::Call 'uxtheme::SetWindowTheme(p r1,w "",w "")'
          SetCtlColors $1 E8EFFB 0D1118
        ${EndIf}
      ${EndIf}
      System::Call 'user32::GetWindow(p r1,i 2)p.r1'
    ${Loop}
    System::Call 'user32::GetWindow(p r0,i 2)p.r0'
  ${Loop}
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!macroend
!insertmacro PapierThemeFunction ""
!insertmacro PapierThemeFunction "un."

Function PapierProgressShow
  Call PapierPageShow
  StrCpy $PapierProgressActive 1
  CreateFont $PapierHeaderFont "Segoe UI" 13 600
  SendMessage $mui.Header.Text ${WM_SETFONT} $PapierHeaderFont 1
  System::Call 'uxtheme::SetWindowTheme(p $mui.InstFilesPage.ProgressBar,w "",w "")'
  SendMessage $mui.InstFilesPage.ProgressBar 0x2001 0 0x18110D
  SendMessage $mui.InstFilesPage.ProgressBar 0x409 0 0xE7CDB9
  Call PapierProgressTick
FunctionEnd

Function PapierProgressTick
  ${If} $PapierProgressActive != 1
    Return
  ${EndIf}
  Push $0
  ; PBM_GETRANGE(FALSE) returns the real upper bound; PBM_GETPOS the actual progress.
  SendMessage $mui.InstFilesPage.ProgressBar 0x407 0 0 $PapierProgressHigh
  SendMessage $mui.InstFilesPage.ProgressBar 0x408 0 0 $0
  ${If} $PapierProgressHigh > 0
    IntOp $0 $0 * 100
    IntOp $PapierPercent $0 / $PapierProgressHigh
    ${If} $PapierPercent > 99
      StrCpy $PapierPercent 99
    ${EndIf}
    SendMessage $mui.Header.Text ${WM_SETTEXT} 0 "STR:$(PapierInstalling)  ·  $PapierPercent%"
  ${EndIf}
  Pop $0
FunctionEnd

Function PapierProgressLeave
  StrCpy $PapierProgressActive 0
FunctionEnd

Function PapierProgressDone
  Call PapierProgressLeave
  ${IfNot} ${Silent}
    SendMessage $mui.Header.Text ${WM_SETTEXT} 0 "STR:$(PapierInstalling)  ·  100%"
  ${EndIf}
FunctionEnd
