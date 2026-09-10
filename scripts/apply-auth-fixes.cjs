const fs = require('node:fs');
const ts = require('typescript');
function replaceFunction(file, name, replacement) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let target;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) target = node; ts.forEachChild(node, visit); }
  visit(ast);
  if (!target) throw new Error(name);
  fs.writeFileSync(file, source.slice(0, target.getStart(ast)) + replacement + source.slice(target.end));
}
const header = 'src/components/navigation/AppHeader.tsx';
replaceFunction(header, 'switchAccount', `async function switchAccount(account: SavedAccount) {
    if (switchingId || loggingOut || account.userId === profile?.user_id) return;
    try {
      setAccountError('');
      setSwitchingId(account.userId);
      const newProfile = await switchSavedAccount(account);
      closeMenu();
      router.replace(newProfile.must_change_password ? '/change-password' : getRoleRoute(newProfile.role));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not switch account. Please retry.');
    } finally { setSwitchingId(null); }
  }`);
replaceFunction(header, 'logout', `async function logout() {
    if (loggingOut || switchingId || !profile) return;
    try {
      setLoggingOut(true);
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      await removeSavedAccount(profile.user_id);
      const remaining = await getSavedAccounts();
      for (const account of remaining) {
        try {
          const nextProfile = await switchSavedAccount(account);
          closeMenu();
          router.replace(nextProfile.must_change_password ? '/change-password' : getRoleRoute(nextProfile.role));
          return;
        } catch { /* Keep unavailable accounts so they can be signed in again. */ }
      }
      closeMenu();
      router.replace('/');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not sign out.');
    } finally { setLoggingOut(false); }
  }`);
let s = fs.readFileSync(header, 'utf8').replace('  getSavedSession,\n', '').replace('  getSavedSession,\r\n', '');
s = `import { switchSavedAccount } from '../../lib/accountAuth';\n` + s;
s = s.replace('      loadAccounts();', "      void loadAccounts().catch(() => setAccountError('Saved accounts could not be loaded.'));");
fs.writeFileSync(header, s);
const login = 'src/features/auth/screens/LoginScreen.tsx';
s = fs.readFileSync(login, 'utf8');
const start = s.indexOf('      /*', s.indexOf('async function handleLogin'));
const end = s.indexOf('      /*\n       * First login', start) >= 0 ? s.indexOf('      /*\n       * First login', start) : s.indexOf('      /*\r\n       * First login', start);
if (start < 0 || end < 0) throw new Error('login markers');
s = s.slice(0,start) + '      const profile = await signInAccount(loginId, password);\n      const role = profile.role;\n\n' + s.slice(end);
s = s.replace("import { supabase } from '../../../lib/supabase';", "import { signInAccount } from '../../../lib/accountAuth';");
s = s.replace(/import \{\s*saveAccount,\s*\} from '..\/..\/..\/lib\/accountStore';/, '');
s = s.replace("'Something went wrong. Please try again.'", "error instanceof Error ? error.message : 'Something went wrong. Please try again.'");
fs.writeFileSync(login, s);
const tab = 'src/components/navigation/AnimatedTabBar.tsx';
s = fs.readFileSync(tab, 'utf8').replace('!focused && !event.defaultPrevented', 'currentRoute?.key !== route.key && !event.defaultPrevented');
fs.writeFileSync(tab, s);
