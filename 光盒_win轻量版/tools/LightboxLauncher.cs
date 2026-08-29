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

        var startInfo = new ProcessStartInfo
        {
            FileName = python,
            Arguments = "\"" + script + "\"",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };

        // The embedded Python runtime is part of the checked-out application
        // bundle. Keep imports from rewriting tracked __pycache__ files every
        // time Lightbox starts.
        startInfo.EnvironmentVariables["PYTHONDONTWRITEBYTECODE"] = "1";
        Process.Start(startInfo);
    }
}
