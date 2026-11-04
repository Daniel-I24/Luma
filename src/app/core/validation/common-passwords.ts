/**
 * The 200 most guessed passwords that would pass the length and character
 * rules once capitalised (compared in lower case): common words of
 * Colombia and of the leaked-password lists with the usual endings
 * (1, 12, 123, 1234, the year) and keyboard patterns. Not exhaustive:
 * Supabase's leaked-password protection can add more (docs/auth-emails.md).
 */
const LIST = [
  'password1 password12 password123 password1234 password2026 contrasena1 contrasena12 contrasena123 contrasena1234 contrasena2026',
  'colombia1 colombia12 colombia123 colombia1234 colombia2026 pasto1 pasto12 pasto123 pasto1234 pasto2026',
  'narino1 narino12 narino123 narino1234 narino2026 bogota1 bogota12 bogota123 bogota1234 bogota2026',
  'medellin1 medellin12 medellin123 medellin1234 medellin2026 cali1 cali12 cali123 cali1234 cali2026',
  'barranquilla1 barranquilla12 barranquilla123 barranquilla1234 barranquilla2026 amor1 amor12 amor123 amor1234 amor2026',
  'teamo1 teamo12 teamo123 teamo1234 teamo2026 qwerty1 qwerty12 qwerty123 qwerty1234 qwerty2026',
  'admin1 admin12 admin123 admin1234 admin2026 welcome1 welcome12 welcome123 welcome1234 welcome2026',
  'bienvenido1 bienvenido12 bienvenido123 bienvenido1234 bienvenido2026 luma1 luma12 luma123 luma1234 luma2026',
  'hola1 hola12 hola123 hola1234 hola2026 futbol1 futbol12 futbol123 futbol1234 futbol2026',
  'america1 america12 america123 america1234 america2026 millonarios1 millonarios12 millonarios123 millonarios1234 millonarios2026',
  'nacional1 nacional12 nacional123 nacional1234 nacional2026 junior1 junior12 junior123 junior1234 junior2026',
  'familia1 familia12 familia123 familia1234 familia2026 dios1 dios12 dios123 dios1234 dios2026',
  'jesus1 jesus12 jesus123 jesus1234 jesus2026 maria1 maria12 maria123 maria1234 maria2026',
  'princesa1 princesa12 princesa123 princesa1234 princesa2026 superman1 superman12 superman123 superman1234 superman2026',
  'batman1 batman12 batman123 batman1234 batman2026 iloveyou1 iloveyou12 iloveyou123 iloveyou1234 iloveyou2026',
  'sunshine1 sunshine12 sunshine123 sunshine1234 sunshine2026 dragon1 dragon12 dragon123 dragon1234 dragon2026',
  'monkey1 monkey12 monkey123 monkey1234 monkey2026 master1 master12 master123 master1234 master2026',
  'shadow1 shadow12 shadow123 shadow1234 shadow2026 football1 football12 football123 football1234 football2026',
  'letmein1 letmein12 letmein123 letmein1234 letmein2026 daniel1 daniel12 daniel123 daniel1234 daniel2026',
  'passw0rd qwerty12345 1q2w3e4r 1qaz2wsx a1b2c3d4 abc12345 abcd1234 asdf1234 zxcv1234 q1w2e3r4',
].join(' ');

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(LIST.split(' '));
