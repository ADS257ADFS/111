using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class LightboxLauncher
{
    [STAThread]
    private static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string python = Path.Combine(root, "runtime", "python", "pythonw.exe");
        string script = Path.Combine(root, "runtime", "service", "win_launcher.py");

        if (!File.Exists(python) || !File.Exists(script))
        {
            MessageBox.Show("光盒运行文件不完整，请重新安装。", "光盒", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = python,
            Arguments = "\"" + script + "\"",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });
    }
}
