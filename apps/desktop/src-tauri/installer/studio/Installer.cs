using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shell;
using System.Windows.Threading;
using Microsoft.Win32;
using Forms = System.Windows.Forms;

[assembly: AssemblyTitle("Papier Setup")]
[assembly: AssemblyProduct("Papier")]
[assembly: AssemblyVersion("1.0.3.0")]
[assembly: AssemblyFileVersion("1.0.3.0")]
class PapierSetup {
 Window window; bool installing, complete; string scratch, installPath; Process backend; DispatcherTimer poll;
 T Get<T>(string name) where T:class { return window.FindName(name) as T; }
 [STAThread] static int Main(string[] args) {
  try { var app = new Application(); var setup = new PapierSetup(); setup.Initialize(); app.Run(setup.window); return 0; }
  catch(Exception e) { MessageBox.Show("Não foi possível abrir o instalador do Papier.\n\n" + e.Message,"Papier",MessageBoxButton.OK,MessageBoxImage.Error); return 1; }
 }
 void Initialize() {
  using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("Installer.xaml")) window=(Window)XamlReader.Load(stream);
  WindowChrome.SetWindowChrome(window,new WindowChrome {CaptionHeight=0,ResizeBorderThickness=new Thickness(0),GlassFrameThickness=new Thickness(0),UseAeroCaptionButtons=false,CornerRadius=new CornerRadius(11)});
  window.Width=Math.Min(940,SystemParameters.WorkArea.Width-40); window.Height=Math.Min(600,SystemParameters.WorkArea.Height-40);
  using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("papier.ico")) { var bitmap=new System.Windows.Media.Imaging.BitmapImage(); bitmap.BeginInit(); bitmap.CacheOption=System.Windows.Media.Imaging.BitmapCacheOption.OnLoad; bitmap.StreamSource=stream; bitmap.EndInit(); window.Icon=bitmap; }
  installPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Papier");
  using(var key=Registry.CurrentUser.OpenSubKey(@"Software\pdfeditor\Papier")) {
   var saved=key==null?null:key.GetValue("") as string;
   if(!String.IsNullOrWhiteSpace(saved) && Path.IsPathRooted(saved)) { installPath=saved; Get<TextBlock>("Existing").Text="Papier já está instalado. Esta instalação atualizará o aplicativo neste local."; Get<Button>("Install").Content="Atualizar Papier     →"; }
  }
  Get<TextBox>("InstallPath").Text=installPath;
  Get<Button>("Browse").Click+=(s,e)=> { using(var picker=new Forms.FolderBrowserDialog { Description="Escolha a pasta do Papier",SelectedPath=Get<TextBox>("InstallPath").Text }) if(picker.ShowDialog()==Forms.DialogResult.OK) Get<TextBox>("InstallPath").Text=picker.SelectedPath; };
  Get<Button>("Install").Click+=async(s,e)=>await Install();
  Get<Button>("Close").Click+=(s,e)=>window.Close();
  Get<Button>("Minimize").Click+=(s,e)=>window.WindowState=WindowState.Minimized;
  Get<Grid>("TitleArea").MouseLeftButtonDown+=(s,e)=> { if(e.OriginalSource is TextBlock || e.OriginalSource is Grid) window.DragMove(); };
  Get<Button>("Launch").Click+=(s,e)=> { try { Process.Start(new ProcessStartInfo(Path.Combine(installPath,"pdf-editor.exe")){UseShellExecute=true,WorkingDirectory=installPath}); window.Close(); } catch(Exception ex) { Get<TextBlock>("Footnote").Text="Não foi possível abrir: "+ex.Message; } };
  window.Closing+=(s,e)=> { if(installing) {e.Cancel=true; Get<TextBlock>("ProgressDetail").Text="A instalação está em andamento. Aguarde a conclusão para fechar.";} };
  window.Closed+=(s,e)=>Cleanup();
  window.TaskbarItemInfo=new TaskbarItemInfo();
  window.Loaded+=(s,e)=> { if(SystemParameters.ClientAreaAnimation) AnimateBrand(); };
 }
 void AnimateBrand() {
  var move=new DoubleAnimation(-5,5,TimeSpan.FromSeconds(4)){AutoReverse=true,RepeatBehavior=RepeatBehavior.Forever,EasingFunction=new SineEase{EasingMode=EasingMode.EaseInOut}};
  ((TranslateTransform)Get<Grid>("BrandObject").RenderTransform).BeginAnimation(TranslateTransform.YProperty,move);
  Get<GradientStop>("Pearl").BeginAnimation(GradientStop.OffsetProperty,new DoubleAnimation(.2,.7,TimeSpan.FromSeconds(6)){AutoReverse=true,RepeatBehavior=RepeatBehavior.Forever});
  ((TranslateTransform)Get<System.Windows.Shapes.Ellipse>("Haze").RenderTransform).BeginAnimation(TranslateTransform.XProperty,new DoubleAnimation(-20,45,TimeSpan.FromSeconds(12)){AutoReverse=true,RepeatBehavior=RepeatBehavior.Forever});
 }
 void Show(string name) {
  foreach(var n in new[]{"SetupPanel","ProgressPanel","ReadyPanel"}) Get<Grid>(n).Visibility=n==name?Visibility.Visible:Visibility.Collapsed;
  if(!SystemParameters.ClientAreaAnimation)return;
  var grid=Get<Grid>(name);var slide=new TranslateTransform();grid.RenderTransform=slide;
  slide.BeginAnimation(TranslateTransform.XProperty,new DoubleAnimation(16,0,TimeSpan.FromMilliseconds(340)){EasingFunction=new CubicEase{EasingMode=EasingMode.EaseOut}});
  grid.BeginAnimation(UIElement.OpacityProperty,new DoubleAnimation(0,1,TimeSpan.FromMilliseconds(240)));
 }
 async Task Install() {
  if(installing||complete)return;
  Get<TextBlock>("SetupError").Text="";
  try {
   installPath=Path.GetFullPath(Get<TextBox>("InstallPath").Text.Trim());
   if(installPath.IndexOf('"')>=0 || installPath.IndexOf('\n')>=0 || installPath.IndexOf('\r')>=0 || installPath.StartsWith(@"\\") || installPath.TrimEnd('\\')==Path.GetPathRoot(installPath).TrimEnd('\\')) throw new Exception("Escolha uma pasta local para o aplicativo, e não a raiz do disco.");
   // Protect existing unrelated folders: NSIS uninstall owns all files in its installation folder.
   if(Directory.Exists(installPath) && Directory.GetFileSystemEntries(installPath).Length>0 && !File.Exists(Path.Combine(installPath,"pdf-editor.exe"))) throw new Exception("Esta pasta contém outros arquivos. Escolha uma pasta vazia ou a pasta atual do Papier.");
   var running=Process.GetProcessesByName("pdf-editor");
   foreach(var process in running) { try { if(String.Equals(process.MainModule.FileName,Path.Combine(installPath,"pdf-editor.exe"),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Feche o Papier antes de atualizar. Seus documentos não serão fechados automaticamente."); } catch(System.ComponentModel.Win32Exception) {} }
   Directory.CreateDirectory(installPath);
   var probe=Path.Combine(installPath,".papier-write-"+Guid.NewGuid().ToString("N"));File.WriteAllText(probe,"");File.Delete(probe);
   last=0;Get<TextBlock>("Percent").Text="0";Get<Border>("Fill").BeginAnimation(FrameworkElement.WidthProperty,null);Get<Border>("Fill").Width=0;
   installing=true; Get<Button>("Close").IsEnabled=false; Show("ProgressPanel"); window.TaskbarItemInfo.ProgressState=TaskbarItemProgressState.Normal;
   scratch=Path.Combine(Path.GetTempPath(),"PapierSetup-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(scratch);
   var exe=Path.Combine(scratch,"Papier-engine.exe");var log=Path.Combine(scratch,"progress.log");
   await Task.Run(()=> { using(var src=Assembly.GetExecutingAssembly().GetManifestResourceStream("engine.exe")) using(var dest=File.Create(exe)) src.CopyTo(dest); });
   var arguments="/S /BRIDGE=\""+log+"\" "+(Get<CheckBox>("Shortcut").IsChecked==true?"":"/NS ")+"/D="+installPath;
   backend=Process.Start(new ProcessStartInfo(exe,arguments){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=scratch});
   poll=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(100)};poll.Tick+=(s,e)=>ReadProgress(log);poll.Start();
   await Task.Run(()=>backend.WaitForExit());poll.Stop();ReadProgress(log);
   if(backend.ExitCode!=0)throw new Exception("O Windows não concluiu a instalação (código "+backend.ExitCode+"). Verifique a pasta escolhida e tente novamente.");
   foreach(var component in new[]{"pdf-editor.exe","pdfium.dll","papier.ico","uninstall.exe"})if(!File.Exists(Path.Combine(installPath,component)))throw new Exception("A instalação está incompleta: "+component+" não foi encontrado. Tente instalar novamente.");
   installing=false;complete=true;Get<Button>("Close").IsEnabled=true;window.TaskbarItemInfo.ProgressValue=1;Show("ReadyPanel");Get<Button>("Launch").Focus();
  } catch(Exception e) { if(poll!=null)poll.Stop(); installing=false; Get<Button>("Close").IsEnabled=true;window.TaskbarItemInfo.ProgressState=TaskbarItemProgressState.Error; Show("SetupPanel");Get<TextBlock>("SetupError").Text=e.Message;Cleanup(); }
 }
 int last=0;
 void ReadProgress(string log) {
  try {
   if(!File.Exists(log))return;
   string contents;using(var stream=new FileStream(log,FileMode.Open,FileAccess.Read,FileShare.ReadWrite))using(var reader=new StreamReader(stream))contents=reader.ReadToEnd();
   var lines=contents.Split(new[]{'\r','\n'},StringSplitOptions.RemoveEmptyEntries);
   if(lines.Length==0)return;
   int value;if(!Int32.TryParse(lines[lines.Length-1],out value))return;
   value=Math.Min(99,Math.Max(last,value));last=value;Get<TextBlock>("Percent").Text=value.ToString();window.TaskbarItemInfo.ProgressValue=value/100.0;
   var target=Get<Border>("Track").ActualWidth*value/100.0;
   if(SystemParameters.ClientAreaAnimation)Get<Border>("Fill").BeginAnimation(FrameworkElement.WidthProperty,new DoubleAnimation(target,TimeSpan.FromMilliseconds(170)));
   else Get<Border>("Fill").Width=target;
   Get<TextBlock>("Phase").Text=value>=98?"Registrando o aplicativo e os atalhos…":"Instalando editor, fontes e ferramentas…";
   Get<TextBlock>("ProgressDetail").Text="Progresso real dos arquivos do pacote · "+value+"% concluído";
  } catch(IOException) {} catch(UnauthorizedAccessException) {}
 }
 void Cleanup() { if(backend!=null){backend.Dispose();backend=null;} if(scratch!=null && Directory.Exists(scratch)) {try{Directory.Delete(scratch,true);}catch(IOException){}catch(UnauthorizedAccessException){}} scratch=null; }
}
