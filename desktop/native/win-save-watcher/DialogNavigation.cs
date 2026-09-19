using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Automation;

namespace Suhuella.SaveWatcher;

/// <summary>
/// Changes the folder shown by a Save / Save As dialog.
/// Never presses Save, never overwrites or renames files.
/// </summary>
internal static class DialogNavigation
{
    static readonly string[] AddressAutomationIds =
    {
        "1001",
        "41477",
        "Address Band Root",
        "Breadcrumb Parent",
        "1137",
    };

    static readonly string[] AddressNames =
    {
        "Address",
        "Address: ",
        "Look in",
        "Look in:",
        "Save in",
        "Save in:",
        "Guardar en",
        "Guardar en:",
        "Buscar en",
        "Buscar en:",
    };

    public static bool TryNavigate(int hwnd, string folder, out string error, out string method)
    {
        error = string.Empty;
        method = "Failed";

        try
        {
            if (hwnd == 0)
            {
                error = "Save dialog is no longer available.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(folder))
            {
                error = "Missing folder path.";
                return false;
            }

            if (!Directory.Exists(folder))
            {
                error = "Folder does not exist.";
                return false;
            }

            var fullFolder = Path.GetFullPath(folder);
            var handle = new IntPtr(hwnd);
            AutomationElement? window;

            try
            {
                window = AutomationElement.FromHandle(handle);
            }
            catch
            {
                window = null;
            }

            if (window == null)
            {
                error = "Save dialog is no longer available.";
                return false;
            }

            NativeKeyboard.TryForeground(handle);

            if (TrySetViaAccessibility(window, fullFolder))
            {
                method = "UIAutomation";
                return true;
            }

            if (TrySetAddressBar(window, fullFolder))
            {
                method = "AddressBar";
                return true;
            }

            if (TryKeyboardNavigate(handle, window, fullFolder, useCtrlL: true))
            {
                method = "CtrlL";
                return true;
            }

            if (TryKeyboardNavigate(handle, window, fullFolder, useCtrlL: false))
            {
                method = "AltD";
                return true;
            }

            if (TryPasteEnter(window, fullFolder))
            {
                method = "PasteEnter";
                return true;
            }

            error = "Could not navigate automatically.";
            return false;
        }
        catch (Exception exception)
        {
            Program.Log("navigation failed: " + exception.Message);
            error = "Could not navigate automatically.";
            method = "Failed";
            return false;
        }
    }

    static bool TrySetViaAccessibility(AutomationElement window, string folder)
    {
        try
        {
            var address = FindAddressControl(window);
            if (address == null || !TrySetValue(address, folder))
            {
                return false;
            }

            if (!TryCommitAddress(address))
            {
                return false;
            }

            return WaitForFolder(window, folder);
        }
        catch (Exception exception)
        {
            Program.Log("accessibility navigation failed: " + exception.Message);
            return false;
        }
    }

    static bool TrySetAddressBar(AutomationElement window, string folder)
    {
        try
        {
            var address = FindAddressControl(window);
            if (address == null)
            {
                return false;
            }

            address.SetFocus();
            if (!TrySetValue(address, folder) && !NativeKeyboard.TypeText(folder))
            {
                return false;
            }

            if (!IsAddressLike(AutomationElement.FocusedElement) && !IsAddressLike(address))
            {
                Program.Log("refusing Enter — address bar is not focused");
                return false;
            }

            if (!TryCommitAddress(address))
            {
                return false;
            }

            return WaitForFolder(window, folder);
        }
        catch (Exception exception)
        {
            Program.Log("address-bar navigation failed: " + exception.Message);
            return false;
        }
    }

    static bool TryPasteEnter(AutomationElement window, string folder)
    {
        try
        {
            var address = FindAddressControl(window);
            if (address == null)
            {
                return false;
            }

            address.SetFocus();
            if (!IsAddressLike(AutomationElement.FocusedElement) && !IsAddressLike(address))
            {
                return false;
            }

            NativeKeyboard.Chord(NativeKeyboard.VK_CONTROL, NativeKeyboard.VK_A);
            Thread.Sleep(15);
            if (!NativeKeyboard.TypeText(folder))
            {
                return false;
            }

            if (!IsAddressLike(AutomationElement.FocusedElement))
            {
                Program.Log("refusing Enter — PasteEnter lost address focus");
                return false;
            }

            NativeKeyboard.Enter();
            return WaitForFolder(window, folder);
        }
        catch (Exception exception)
        {
            Program.Log("PasteEnter navigation failed: " + exception.Message);
            return false;
        }
    }

    static bool TryKeyboardNavigate(IntPtr handle, AutomationElement window, string folder, bool useCtrlL)
    {
        try
        {
            NativeKeyboard.TryForeground(handle);
            Thread.Sleep(25);

            if (useCtrlL)
            {
                NativeKeyboard.Chord(NativeKeyboard.VK_CONTROL, NativeKeyboard.VK_L);
            }
            else
            {
                NativeKeyboard.Chord(NativeKeyboard.VK_MENU, NativeKeyboard.VK_D);
            }

            Thread.Sleep(40);
            var focused = AutomationElement.FocusedElement;
            if (!IsAddressLike(focused))
            {
                Program.Log((useCtrlL ? "Ctrl+L" : "Alt+D") + " did not focus an address field");
                return false;
            }

            if (!TrySetValue(focused, folder))
            {
                NativeKeyboard.Chord(NativeKeyboard.VK_CONTROL, NativeKeyboard.VK_A);
                Thread.Sleep(15);
                if (!NativeKeyboard.TypeText(folder))
                {
                    return false;
                }
            }

            focused = AutomationElement.FocusedElement;
            if (!IsAddressLike(focused))
            {
                Program.Log("refusing Enter — keyboard shortcut did not keep address focus");
                return false;
            }

            NativeKeyboard.Enter();
            return WaitForFolder(window, folder);
        }
        catch (Exception exception)
        {
            Program.Log("keyboard navigation failed: " + exception.Message);
            return false;
        }
    }

    static AutomationElement? FindAddressControl(AutomationElement window)
    {
        foreach (var automationId in AddressAutomationIds)
        {
            var match = Program.FindDescendantByAutomationId(window, automationId);
            if (match != null)
            {
                return PreferEditable(match);
            }
        }

        foreach (var name in AddressNames)
        {
            var match = Program.FindDescendantByName(window, name);
            if (match != null)
            {
                return PreferEditable(match);
            }
        }

        try
        {
            var toolbars = window.FindAll(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ToolBar));
            foreach (AutomationElement toolbar in toolbars)
            {
                var label = toolbar.Current.Name ?? string.Empty;
                if (label.IndexOf("Address", StringComparison.OrdinalIgnoreCase) >= 0
                    || label.IndexOf("Dirección", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return PreferEditable(toolbar);
                }
            }
        }
        catch
        {
            // Keep going.
        }

        return null;
    }

    static AutomationElement PreferEditable(AutomationElement element)
    {
        try
        {
            var edit = element.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
            return edit ?? element;
        }
        catch
        {
            return element;
        }
    }

    static bool TrySetValue(AutomationElement element, string folder)
    {
        try
        {
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern)
                && pattern is ValuePattern valuePattern
                && !valuePattern.Current.IsReadOnly)
            {
                valuePattern.SetValue(folder);
                return true;
            }
        }
        catch (Exception exception)
        {
            Program.Log("ValuePattern.SetValue failed: " + exception.Message);
        }

        return false;
    }

    static bool TryCommitAddress(AutomationElement address)
    {
        try
        {
            address.SetFocus();
        }
        catch
        {
            return false;
        }

        if (!IsAddressLike(AutomationElement.FocusedElement) && !IsAddressLike(address))
        {
            Program.Log("refusing Enter — could not focus address bar");
            return false;
        }

        NativeKeyboard.Enter();
        return true;
    }

    static bool IsAddressLike(AutomationElement? element)
    {
        if (element == null)
        {
            return false;
        }

        try
        {
            var type = element.Current.ControlType;
            if (type == ControlType.Edit || type == ControlType.ComboBox || type == ControlType.ToolBar)
            {
                return true;
            }

            var automationId = element.Current.AutomationId ?? string.Empty;
            foreach (var id in AddressAutomationIds)
            {
                if (string.Equals(automationId, id, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            var name = element.Current.Name ?? string.Empty;
            return name.IndexOf("Address", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Look in", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Save in", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("Guardar en", StringComparison.OrdinalIgnoreCase) >= 0;
        }
        catch
        {
            return false;
        }
    }

    static bool WaitForFolder(AutomationElement window, string folder)
    {
        for (var attempt = 0; attempt < 4; attempt++)
        {
            Thread.Sleep(40);
            var current = Program.TryGetCurrentFolder(window);
            if (SameFolder(current, folder))
            {
                return true;
            }
        }

        return SameFolder(Program.TryGetCurrentFolder(window), folder);
    }

    static bool SameFolder(string left, string right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right))
        {
            return false;
        }

        try
        {
            return string.Equals(
                Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}

internal static class NativeKeyboard
{
    public const byte VK_CONTROL = 0x11;
    public const byte VK_MENU = 0x12;
    public const byte VK_RETURN = 0x0D;
    public const byte VK_L = 0x4C;
    public const byte VK_D = 0x44;
    public const byte VK_A = 0x41;

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    public static void TryForeground(IntPtr handle)
    {
        if (handle == IntPtr.Zero)
        {
            return;
        }

        try
        {
            SetForegroundWindow(handle);
        }
        catch
        {
            // Keyboard fallbacks may still work if the dialog already has focus.
        }
    }

    public static void Chord(params byte[] keys)
    {
        foreach (var key in keys)
        {
            SendVirtualKey(key, keyUp: false);
        }

        for (var index = keys.Length - 1; index >= 0; index--)
        {
            SendVirtualKey(keys[index], keyUp: true);
        }
    }

    public static void Enter()
    {
        SendVirtualKey(VK_RETURN, keyUp: false);
        SendVirtualKey(VK_RETURN, keyUp: true);
    }

    public static bool TypeText(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return false;
        }

        try
        {
            foreach (var character in text)
            {
                SendUnicode(character, keyUp: false);
                SendUnicode(character, keyUp: true);
            }

            return true;
        }
        catch (Exception exception)
        {
            Program.Log("TypeText failed: " + exception.Message);
            return false;
        }
    }

    static void SendVirtualKey(byte virtualKey, bool keyUp)
    {
        var input = new INPUT
        {
            type = INPUT_KEYBOARD,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = virtualKey,
                    wScan = 0,
                    dwFlags = keyUp ? KEYEVENTF_KEYUP : 0,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero,
                },
            },
        };
        SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>());
    }

    static void SendUnicode(char character, bool keyUp)
    {
        var input = new INPUT
        {
            type = INPUT_KEYBOARD,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = 0,
                    wScan = character,
                    dwFlags = KEYEVENTF_UNICODE | (keyUp ? KEYEVENTF_KEYUP : 0),
                    time = 0,
                    dwExtraInfo = IntPtr.Zero,
                },
            },
        };
        SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>());
    }

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion
    {
        [FieldOffset(0)]
        public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
}
