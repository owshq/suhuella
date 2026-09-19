using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Threading;

namespace Suhuella.SaveWatcher;

/// <summary>
/// Small Windows helper. Watches for common Save / Save As dialogs via UI Automation
/// and writes one JSON line per detection to stdout. Navigation commands arrive on
/// stdin. File names and folder paths stay on this machine — this process never
/// opens a network connection.
/// </summary>
internal static class Program
{
    static bool DevMode;
    static Dispatcher? UiDispatcher;
    static int LastDialogHwnd;

    static readonly ConcurrentDictionary<int, long> RecentWindows = new();
    static readonly ConcurrentDictionary<int, byte> TrackedDialogs = new();

    static readonly string[] SaveAsTitleTokens =
    {
        "save as",
        "save file",
        "guardar como",
        "guardar archivo",
        "enregistrer sous",
        "enregistrer le fichier",
        "speichern unter",
        "salva con nome",
        "salvar como",
        "zapisz jako",
    };

    static readonly string[] ExactSaveTitles =
    {
        "save",
        "guardar",
        "enregistrer",
        "speichern",
        "salva",
        "salvar",
        "zapisz",
    };

    static readonly string[] ConfirmTitleTokens =
    {
        "save changes",
        "want to save",
        "do you want",
        "guardar los cambios",
        "guardar cambios",
        "don't save",
        "no guardar",
        "confirm save",
    };

    static readonly string[] OpenTitleTokens =
    {
        "open",
        "abrir",
        "ouvrir",
        "öffnen",
        "apri",
        "browse",
    };

    static readonly string[] FileNameAutomationIds =
    {
        "1148",
        "FileNameControlHost",
        "cmb13",
        "4144",
    };

    static readonly string[] FileNameLabels =
    {
        "File name",
        "File name:",
        "Nombre de archivo",
        "Nombre de archivo:",
        "Nom du fichier",
        "Nom du fichier :",
        "Dateiname",
        "Nome file",
        "Nome do arquivo",
    };

    [STAThread]
    static void Main(string[] args)
    {
        DevMode =
            Array.Exists(args, argument => argument == "--dev")
            || string.Equals(Environment.GetEnvironmentVariable("SUHUELLA_DEV"), "1", StringComparison.Ordinal);

        try
        {
            Console.OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
            Console.InputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        }
        catch
        {
            // Keep the default encoding if the console cannot switch.
        }

        Log("starting Windows Save / Save As watcher");
        UiDispatcher = Dispatcher.CurrentDispatcher;

        try
        {
            // Subtree also sees owned Office / Explorer dialogs that are not
            // direct desktop children. Idle cost stays event-driven.
            Automation.AddAutomationEventHandler(
                WindowPattern.WindowOpenedEvent,
                AutomationElement.RootElement,
                TreeScope.Subtree,
                OnWindowOpened);
        }
        catch (Exception exception)
        {
            Log("failed to subscribe to WindowOpenedEvent: " + exception.Message);
            Environment.ExitCode = 1;
            return;
        }

        StartStdinReader();

        var frame = new DispatcherFrame();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            frame.Continue = false;
        };
        Dispatcher.PushFrame(frame);

        try
        {
            Automation.RemoveAllEventHandlers();
        }
        catch
        {
            // Best-effort cleanup.
        }

        Log("stopped");
    }

    static void StartStdinReader()
    {
        var dispatcher = UiDispatcher;
        if (dispatcher == null)
        {
            return;
        }

        var thread = new Thread(() =>
        {
            try
            {
                string? line;
                while ((line = Console.In.ReadLine()) != null)
                {
                    var command = line;
                    dispatcher.BeginInvoke(new Action(() => HandleCommand(command)));
                }
            }
            catch (Exception exception)
            {
                Log("stdin reader stopped: " + exception.Message);
            }
        })
        {
            IsBackground = true,
            Name = "suhuella-stdin",
        };
        thread.Start();
    }

    static void HandleCommand(string line)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                return;
            }

            var type = ReadJsonString(line, "type");
            if (type != "navigate-folder")
            {
                Log("ignored helper command type=" + type);
                return;
            }

            var requestId = ReadJsonString(line, "requestId");
            var windowHandle = ReadJsonString(line, "windowHandle");
            var folder = ReadJsonString(line, "folder");
            var hwnd = ParseHandle(windowHandle);
            if (hwnd == 0)
            {
                hwnd = LastDialogHwnd;
            }

            Log($"navigate request id={requestId} hwnd={hwnd} folder=\"{folder}\"");

            var ok = DialogNavigation.TryNavigate(hwnd, folder, out var error, out var method);
            Log(ok ? "navigation succeeded method=" + method : "navigation failed method=" + method + " " + error);
            EmitNavigateResult(requestId, ok, hwnd, folder, error, method);
        }
        catch (Exception exception)
        {
            Log("command handler failed: " + exception.Message);
            EmitNavigateResult(string.Empty, false, 0, string.Empty, "Could not navigate automatically.", "Failed");
        }
    }

    static void OnWindowOpened(object sender, AutomationEventArgs eventArgs)
    {
        try
        {
            if (sender is not AutomationElement window)
            {
                return;
            }

            if (TryEmitSaveDialog(window))
            {
                return;
            }

            // Common Item Dialog chrome is sometimes empty on the first event.
            var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(50) };
            timer.Tick += (_, _) =>
            {
                timer.Stop();
                try
                {
                    TryEmitSaveDialog(window);
                }
                catch (Exception exception)
                {
                    Log("delayed inspect failed: " + exception.Message);
                }
            };
            timer.Start();
        }
        catch (Exception exception)
        {
            Log("window handler failed: " + exception.Message);
        }
    }

    static bool TryEmitSaveDialog(AutomationElement window)
    {
        int hwnd;
        string windowTitle;
        string className;
        int processId;

        try
        {
            hwnd = window.Current.NativeWindowHandle;
            windowTitle = window.Current.Name ?? string.Empty;
            className = window.Current.ClassName ?? string.Empty;
            processId = window.Current.ProcessId;
        }
        catch (ElementNotAvailableException)
        {
            return false;
        }
        catch (Exception exception)
        {
            Log("could not read window properties: " + exception.Message);
            return false;
        }

        Log($"window opened title=\"{windowTitle}\" class=\"{className}\" pid={processId} hwnd={hwnd}");

        var processName = TryGetProcessName(processId);
        if (IsOwnProcess(processName))
        {
            Log("ignored SuHuella / helper window");
            return false;
        }

        if (!IsLikelySaveDialog(window, windowTitle, className))
        {
            MaybeEmitIgnored(window, windowTitle, className, processName, hwnd);
            return false;
        }

        if (!ShouldEmit(hwnd))
        {
            return false;
        }

        var fileName = TryGetFileName(window);
        var currentFolder = TryGetCurrentFolder(window);
        var extension = ExtensionOf(fileName);
        var filenameFieldFound = HasFileNameField(window);
        var hints = CollectAutomationHints(window);

        LastDialogHwnd = hwnd;
        TrackedDialogs.TryAdd(hwnd, 0);
        WatchDialogClosed(window, hwnd);

        EmitOpened(
            windowTitle,
            processName,
            fileName,
            extension,
            currentFolder,
            hwnd,
            className,
            filenameFieldFound,
            currentFolder.Length > 0,
            hints);
        Log(
            $"emitted save-dialog-opened fileName=\"{fileName}\" ext=\"{extension}\" folder=\"{currentFolder}\" app=\"{processName}\" hwnd={hwnd} class=\"{className}\" field={filenameFieldFound} hints={hints}");
        return true;
    }

    static void WatchDialogClosed(AutomationElement window, int hwnd)
    {
        try
        {
            Automation.AddAutomationEventHandler(
                WindowPattern.WindowClosedEvent,
                window,
                TreeScope.Element,
                (_, _) =>
                {
                    try
                    {
                        if (!TrackedDialogs.TryRemove(hwnd, out _))
                        {
                            return;
                        }

                        if (LastDialogHwnd == hwnd)
                        {
                            LastDialogHwnd = 0;
                        }

                        EmitClosed(hwnd);
                        Log($"emitted save-dialog-closed hwnd={hwnd}");
                    }
                    catch (Exception exception)
                    {
                        Log("window-closed handler failed: " + exception.Message);
                    }
                });
        }
        catch (Exception exception)
        {
            Log("could not subscribe to WindowClosedEvent: " + exception.Message);
        }
    }

    static bool IsLikelySaveDialog(AutomationElement window, string windowTitle, string className)
    {
        var title = (windowTitle ?? string.Empty).Trim().ToLowerInvariant();
        if (LooksLikeOpenDialog(title) || ContainsAny(title, ConfirmTitleTokens))
        {
            return false;
        }

        var titleLooksLikeSaveAs = ContainsAny(title, SaveAsTitleTokens);
        var titleLooksLikeSave = Array.Exists(
            ExactSaveTitles,
            token => title == token || title.StartsWith(token + " ", StringComparison.Ordinal));
        var isCommonDialog = string.Equals(className, "#32770", StringComparison.Ordinal);
        var hasFileNameField = HasFileNameField(window);
        var hasSaveButton = HasNamedButton(window, "save", "guardar", "enregistrer", "speichern", "salva", "salvar");
        var looksLikeCommonItemDialog = FindDescendantByAutomationId(window, "FileNameControlHost") != null;

        if (titleLooksLikeSaveAs && (isCommonDialog || hasFileNameField || hasSaveButton || looksLikeCommonItemDialog))
        {
            return true;
        }

        // Prefer false negatives: a bare "Save" title is not enough without dialog chrome.
        if (titleLooksLikeSave && (isCommonDialog || looksLikeCommonItemDialog) && (hasFileNameField || hasSaveButton))
        {
            return true;
        }

        // Untitled or app-branded common dialogs (Office, Explorer, some Electron hosts).
        if ((isCommonDialog || looksLikeCommonItemDialog) && hasFileNameField && hasSaveButton)
        {
            return true;
        }

        // TODO: Photoshop, some Adobe and WinUI hosts use custom chrome without
        // #32770 / FileNameControlHost. Ignore those rather than guessing.
        return false;
    }

    static string ClassifyIgnoredDialog(string windowTitle, string className, AutomationElement window)
    {
        var title = (windowTitle ?? string.Empty).Trim().ToLowerInvariant();
        if (ContainsAny(title, ConfirmTitleTokens))
        {
            return "confirm-dialog";
        }

        if (LooksLikeOpenDialog(title))
        {
            return "open-dialog";
        }

        var titleLooksLikeSaveAs = ContainsAny(title, SaveAsTitleTokens);
        var titleLooksLikeSave = Array.Exists(
            ExactSaveTitles,
            token => title == token || title.StartsWith(token + " ", StringComparison.Ordinal));
        var isCommonDialog = string.Equals(className, "#32770", StringComparison.Ordinal);

        if (titleLooksLikeSaveAs || titleLooksLikeSave)
        {
            return "insufficient-save-dialog-chrome";
        }

        if (isCommonDialog && !HasFileNameField(window))
        {
            return "common-dialog-without-filename";
        }

        return string.Empty;
    }

    static void MaybeEmitIgnored(
        AutomationElement window,
        string windowTitle,
        string className,
        string processName,
        int hwnd)
    {
        if (!DevMode)
        {
            return;
        }

        var reason = ClassifyIgnoredDialog(windowTitle, className, window);
        if (reason.Length == 0)
        {
            return;
        }

        Log($"classified ignored dialog reason={reason} title=\"{windowTitle}\" class=\"{className}\" hwnd={hwnd}");
        WriteJson(
            "{\"type\":\"save-dialog-ignored\""
            + ",\"windowTitle\":\"" + JsonEscape(windowTitle) + "\""
            + ",\"processName\":\"" + JsonEscape(processName) + "\""
            + ",\"className\":\"" + JsonEscape(className) + "\""
            + ",\"windowHandle\":\"" + hwnd + "\""
            + ",\"reason\":\"" + JsonEscape(reason) + "\""
            + ",\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\"}");
    }

    static AutomationElement? FindFileNameControl(AutomationElement window)
    {
        try
        {
            foreach (var controlType in new[] { ControlType.Edit, ControlType.ComboBox })
            {
                var edits = window.FindAll(
                    TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.ControlTypeProperty, controlType));
                foreach (AutomationElement edit in edits)
                {
                    var name = NormalizeControlName(TryReadName(edit));
                    if (name.Contains("file name")
                        || name.Contains("nombre de archivo")
                        || name.Contains("nom du fichier")
                        || name.Contains("dateiname"))
                    {
                        return edit;
                    }
                }
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    static bool LooksLikeOpenDialog(string title)
    {
        if (string.IsNullOrEmpty(title))
        {
            return false;
        }

        if (ContainsAny(title, SaveAsTitleTokens) || ContainsAny(title, ExactSaveTitles))
        {
            return false;
        }

        return ContainsAny(title, OpenTitleTokens);
    }

    static bool HasFileNameField(AutomationElement window)
    {
        try
        {
            foreach (var automationId in FileNameAutomationIds)
            {
                if (FindDescendantByAutomationId(window, automationId) != null)
                {
                    return true;
                }
            }

            foreach (var label in FileNameLabels)
            {
                if (FindDescendantByName(window, label) != null)
                {
                    return true;
                }
            }

            return FindFileNameControl(window) != null;
        }
        catch (Exception exception)
        {
            Log("file name field probe failed: " + exception.Message);
        }

        return false;
    }

    static string TryGetFileName(AutomationElement window)
    {
        try
        {
            foreach (var automationId in FileNameAutomationIds)
            {
                var match = FindDescendantByAutomationId(window, automationId);
                var value = TryReadValue(match);
                if (LooksLikeFileName(value))
                {
                    return NormalizeFileName(value);
                }
            }

            foreach (var label in FileNameLabels)
            {
                var match = FindDescendantByName(window, label);
                var value = TryReadValue(match) ?? TryReadNearbyEdit(match);
                if (LooksLikeFileName(value))
                {
                    return NormalizeFileName(value);
                }
            }

            var inferred = FindFileNameControl(window);
            var inferredValue = TryReadValue(inferred);
            if (LooksLikeFileName(inferredValue))
            {
                return NormalizeFileName(inferredValue);
            }

            // TODO: Chromium / WPF / WinUI save panes often expose the file name as a
            // custom combo or document title instead of the classic File name edit.
        }
        catch (Exception exception)
        {
            Log("file name extraction failed: " + exception.Message);
        }

        return string.Empty;
    }

    internal static string TryGetCurrentFolder(AutomationElement window)
    {
        try
        {
            foreach (var automationId in new[] { "1001", "41477", "Address Band Root", "Breadcrumb Parent", "1137" })
            {
                var match = FindDescendantByAutomationId(window, automationId);
                var value = TryReadValue(match) ?? TryReadName(match);
                var folder = NormalizeFolder(value);
                if (folder.Length > 0)
                {
                    return folder;
                }
            }

            var toolbars = window.FindAll(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ToolBar));

            foreach (AutomationElement toolbar in toolbars)
            {
                var folder = NormalizeFolder(TryReadName(toolbar));
                if (folder.Length > 0)
                {
                    return folder;
                }
            }

            // TODO: Modern Common Item Dialog breadcrumbs and sandboxed apps (Store,
            // some browsers) may hide the real filesystem path from UI Automation.
        }
        catch (Exception exception)
        {
            Log("folder extraction failed: " + exception.Message);
        }

        return string.Empty;
    }

    static bool HasNamedButton(AutomationElement window, params string[] names)
    {
        try
        {
            var buttons = window.FindAll(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));

            foreach (AutomationElement button in buttons)
            {
                var name = NormalizeControlName(TryReadName(button));
                foreach (var expected in names)
                {
                    if (name == expected || name.StartsWith(expected + " ", StringComparison.Ordinal))
                    {
                        return true;
                    }
                }
            }
        }
        catch (Exception exception)
        {
            Log("button scan failed: " + exception.Message);
        }

        return false;
    }

    internal static AutomationElement? FindDescendantByAutomationId(AutomationElement root, string automationId)
    {
        try
        {
            return root.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, automationId));
        }
        catch
        {
            return null;
        }
    }

    internal static AutomationElement? FindDescendantByName(AutomationElement root, string name)
    {
        try
        {
            return root.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.NameProperty, name));
        }
        catch
        {
            return null;
        }
    }

    static string? TryReadNearbyEdit(AutomationElement? labeled)
    {
        if (labeled == null)
        {
            return null;
        }

        try
        {
            var parent = TreeWalker.ControlViewWalker.GetParent(labeled) ?? labeled;
            var edit = parent.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
            return TryReadValue(edit);
        }
        catch
        {
            return null;
        }
    }

    static string? TryReadValue(AutomationElement? element)
    {
        if (element == null)
        {
            return null;
        }

        try
        {
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern) && pattern is ValuePattern valuePattern)
            {
                return valuePattern.Current.Value;
            }
        }
        catch
        {
            // Fall through to Name.
        }

        return TryReadName(element);
    }

    static string? TryReadName(AutomationElement? element)
    {
        if (element == null)
        {
            return null;
        }

        try
        {
            return element.Current.Name;
        }
        catch
        {
            return null;
        }
    }

    static string TryGetProcessName(int processId)
    {
        if (processId <= 0)
        {
            return string.Empty;
        }

        try
        {
            using var process = Process.GetProcessById(processId);
            return process.ProcessName ?? string.Empty;
        }
        catch (Exception exception)
        {
            Log("process name lookup failed: " + exception.Message);
            return string.Empty;
        }
    }

    static bool IsOwnProcess(string processName)
    {
        var name = processName.ToLowerInvariant();
        var token = (Environment.GetEnvironmentVariable("PRODUCT_PROCESS_TOKEN") ?? "").Trim().ToLowerInvariant();
        return name.Contains("suhuella")
            || name == "suhuellasavewatcher"
            || (!string.IsNullOrEmpty(token) && name.Contains(token));
    }

    static bool ShouldEmit(int hwnd)
    {
        if (hwnd == 0)
        {
            return true;
        }

        var now = Environment.TickCount;
        if (RecentWindows.TryGetValue(hwnd, out var last) && unchecked(now - last) < 2500)
        {
            return false;
        }

        RecentWindows[hwnd] = now;
        return true;
    }

    static bool LooksLikeFileName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            var name = Path.GetFileName(value.Trim().Trim('"'));
            return name.Length > 0 && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
        }
        catch
        {
            return false;
        }
    }

    static string NormalizeFileName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim().Trim('"');
        try
        {
            return Path.GetFileName(trimmed);
        }
        catch
        {
            return trimmed;
        }
    }

    static string NormalizeFolder(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var folder = value.Trim();
        const string addressPrefix = "Address: ";
        if (folder.StartsWith(addressPrefix, StringComparison.OrdinalIgnoreCase))
        {
            folder = folder.Substring(addressPrefix.Length).Trim();
        }
        else if (folder.StartsWith("Address", StringComparison.OrdinalIgnoreCase) && folder.Contains(":"))
        {
            folder = folder.Substring(folder.IndexOf(':') + 1).Trim();
        }

        if (folder.Length >= 2 && char.IsLetter(folder[0]) && folder[1] == ':')
        {
            return folder;
        }

        if (folder.StartsWith(@"\\", StringComparison.Ordinal))
        {
            return folder;
        }

        return string.Empty;
    }

    static string NormalizeControlName(string? value)
    {
        return (value ?? string.Empty).Trim().TrimStart('&').ToLowerInvariant();
    }

    static string ExtensionOf(string fileName)
    {
        try
        {
            var extension = Path.GetExtension(fileName);
            return extension.StartsWith(".", StringComparison.Ordinal) ? extension.Substring(1) : extension;
        }
        catch
        {
            return string.Empty;
        }
    }

    static bool ContainsAny(string value, string[] tokens)
    {
        foreach (var token in tokens)
        {
            if (value.IndexOf(token, StringComparison.Ordinal) >= 0)
            {
                return true;
            }
        }

        return false;
    }

    static int ParseHandle(string value)
    {
        if (int.TryParse(value, out var hwnd))
        {
            return hwnd;
        }

        if (long.TryParse(value, out var wide))
        {
            return unchecked((int)wide);
        }

        return 0;
    }

    static string ReadJsonString(string json, string key)
    {
        var needle = "\"" + key + "\"";
        var keyIndex = json.IndexOf(needle, StringComparison.Ordinal);
        if (keyIndex < 0)
        {
            return string.Empty;
        }

        var colon = json.IndexOf(':', keyIndex + needle.Length);
        if (colon < 0)
        {
            return string.Empty;
        }

        var start = json.IndexOf('"', colon + 1);
        if (start < 0)
        {
            return string.Empty;
        }

        var builder = new StringBuilder();
        for (var index = start + 1; index < json.Length; index++)
        {
            var character = json[index];
            if (character == '\\' && index + 1 < json.Length)
            {
                var escaped = json[++index];
                builder.Append(escaped switch
                {
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    '"' => '"',
                    '\\' => '\\',
                    _ => escaped,
                });
                continue;
            }

            if (character == '"')
            {
                break;
            }

            builder.Append(character);
        }

        return builder.ToString();
    }

    static string CollectAutomationHints(AutomationElement window)
    {
        var hints = new List<string>();
        foreach (var id in new[] { "1148", "FileNameControlHost", "cmb13", "4144", "1001", "41477", "Address Band Root", "1137" })
        {
            if (FindDescendantByAutomationId(window, id) != null)
            {
                hints.Add(id);
            }
        }

        return string.Join(",", hints);
    }

    static void EmitOpened(
        string windowTitle,
        string processName,
        string fileName,
        string extension,
        string currentFolder,
        int hwnd,
        string className,
        bool filenameFieldFound,
        bool currentFolderFound,
        string automationHints)
    {
        WriteJson(
            "{\"type\":\"save-dialog-opened\""
            + ",\"windowTitle\":\"" + JsonEscape(windowTitle) + "\""
            + ",\"processName\":\"" + JsonEscape(processName) + "\""
            + ",\"fileName\":\"" + JsonEscape(fileName) + "\""
            + ",\"extension\":\"" + JsonEscape(extension) + "\""
            + ",\"currentFolder\":\"" + JsonEscape(currentFolder) + "\""
            + ",\"windowHandle\":\"" + hwnd + "\""
            + ",\"className\":\"" + JsonEscape(className) + "\""
            + ",\"filenameFieldFound\":" + (filenameFieldFound ? "true" : "false")
            + ",\"currentFolderFound\":" + (currentFolderFound ? "true" : "false")
            + ",\"automationHints\":\"" + JsonEscape(automationHints) + "\""
            + ",\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\"}");
    }

    static void EmitClosed(int hwnd)
    {
        WriteJson(
            "{\"type\":\"save-dialog-closed\""
            + ",\"windowHandle\":\"" + hwnd + "\""
            + ",\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\"}");
    }

    static void EmitNavigateResult(string requestId, bool ok, int hwnd, string folder, string error, string method)
    {
        WriteJson(
            "{\"type\":\"navigate-result\""
            + ",\"requestId\":\"" + JsonEscape(requestId) + "\""
            + ",\"ok\":" + (ok ? "true" : "false")
            + ",\"windowHandle\":\"" + hwnd + "\""
            + ",\"folder\":\"" + JsonEscape(folder) + "\""
            + ",\"error\":\"" + JsonEscape(error) + "\""
            + ",\"navigationMethod\":\"" + JsonEscape(method) + "\"}");
    }

    static void WriteJson(string line)
    {
        try
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
        catch (Exception exception)
        {
            Log("failed to write JSON event: " + exception.Message);
        }
    }

    static string JsonEscape(string value)
    {
        var builder = new StringBuilder(value.Length + 8);
        foreach (var character in value)
        {
            switch (character)
            {
                case '\\':
                    builder.Append("\\\\");
                    break;
                case '"':
                    builder.Append("\\\"");
                    break;
                case '\n':
                    builder.Append("\\n");
                    break;
                case '\r':
                    builder.Append("\\r");
                    break;
                case '\t':
                    builder.Append("\\t");
                    break;
                default:
                    if (character < ' ')
                    {
                        builder.Append("\\u");
                        builder.Append(((int)character).ToString("x4"));
                    }
                    else
                    {
                        builder.Append(character);
                    }
                    break;
            }
        }

        return builder.ToString();
    }

    internal static void Log(string message)
    {
        if (!DevMode)
        {
            return;
        }

        try
        {
            Console.Error.WriteLine("[save-watcher] " + message);
            Console.Error.Flush();
        }
        catch
        {
            // Never crash because logging failed.
        }
    }
}
