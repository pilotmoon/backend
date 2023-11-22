let SessionLoad = 1
let s:so_save = &g:so | let s:siso_save = &g:siso | setg so=0 siso=0 | setl so=-1 siso=-1
let v:this_session=expand("<sfile>:p")
silent only
silent tabonly
cd ~/work/backend
if expand('%') == '' && !&modified && line('$') <= 1 && getline(1) == ''
  let s:wipebuf = bufnr('%')
endif
let s:shortmess_save = &shortmess
if &shortmess =~ 'A'
  set shortmess=aoOA
else
  set shortmess=aoO
endif
badd +4 src/logger.ts
badd +1 src/product.ts
badd +11 src/sanitizeName.ts
badd +30 src/api/auth.ts
badd +42 test/api/setup.ts
badd +135 test/api/testApiKeys.ts
badd +6590 term://~/work/backend//28578:/bin/zsh
badd +28 term://~/work/backend//29540:/bin/zsh
badd +0 term://~/work/backend//29995:/bin/zsh
badd +1 biome.json
badd +22 misc/github.js
badd +134 term://~/work/backend//32730:/bin/zsh
badd +0 term://~/work/backend//33986:/bin/zsh
argglobal
%argdel
$argadd NvimTree_1
set stal=2
tabnew +setlocal\ bufhidden=wipe
tabnew +setlocal\ bufhidden=wipe
tabrewind
edit biome.json
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd w
wincmd _ | wincmd |
split
1wincmd k
wincmd w
let &splitbelow = s:save_splitbelow
let &splitright = s:save_splitright
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
exe 'vert 1resize ' . ((&columns * 30 + 106) / 212)
exe '2resize ' . ((&lines * 27 + 29) / 58)
exe 'vert 2resize ' . ((&columns * 181 + 106) / 212)
exe '3resize ' . ((&lines * 27 + 29) / 58)
exe 'vert 3resize ' . ((&columns * 181 + 106) / 212)
argglobal
enew
file NvimTree_1
balt src/logger.ts
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal nofen
lcd ~/work/backend
wincmd w
argglobal
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
silent! normal! zE
let &fdl = &fdl
let s:l = 17 - ((16 * winheight(0) + 13) / 27)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 17
normal! 03|
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//33986:/bin/zsh", ":p")) | buffer term://~/work/backend//33986:/bin/zsh | else | edit term://~/work/backend//33986:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//33986:/bin/zsh
endif
balt ~/work/backend/biome.json
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 67 - ((15 * winheight(0) + 13) / 27)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 67
normal! 020|
lcd ~/work/backend
wincmd w
exe 'vert 1resize ' . ((&columns * 30 + 106) / 212)
exe '2resize ' . ((&lines * 27 + 29) / 58)
exe 'vert 2resize ' . ((&columns * 181 + 106) / 212)
exe '3resize ' . ((&lines * 27 + 29) / 58)
exe 'vert 3resize ' . ((&columns * 181 + 106) / 212)
tabnext
edit ~/work/backend/test/api/testApiKeys.ts
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
argglobal
balt term://~/work/backend//32730:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
silent! normal! zE
let &fdl = &fdl
let s:l = 135 - ((28 * winheight(0) + 27) / 55)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 135
normal! 017|
lcd ~/work/backend
tabnext
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd w
wincmd _ | wincmd |
split
1wincmd k
wincmd w
let &splitbelow = s:save_splitbelow
let &splitright = s:save_splitright
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
wincmd =
argglobal
if bufexists(fnamemodify("term://~/work/backend//28578:/bin/zsh", ":p")) | buffer term://~/work/backend//28578:/bin/zsh | else | edit term://~/work/backend//28578:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//28578:/bin/zsh
endif
balt ~/work/backend/test/api/testApiKeys.ts
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 7337 - ((11 * winheight(0) + 27) / 55)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 7337
normal! 039|
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//29540:/bin/zsh", ":p")) | buffer term://~/work/backend//29540:/bin/zsh | else | edit term://~/work/backend//29540:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//29540:/bin/zsh
endif
balt term://~/work/backend//28578:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 4691 - ((22 * winheight(0) + 11) / 23)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 4691
normal! 0
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//29995:/bin/zsh", ":p")) | buffer term://~/work/backend//29995:/bin/zsh | else | edit term://~/work/backend//29995:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//29995:/bin/zsh
endif
balt term://~/work/backend//29540:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 1087 - ((30 * winheight(0) + 15) / 31)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 1087
normal! 0
lcd ~/work/backend
wincmd w
wincmd =
tabnext 2
set stal=1
if exists('s:wipebuf') && len(win_findbuf(s:wipebuf)) == 0 && getbufvar(s:wipebuf, '&buftype') isnot# 'terminal'
  silent exe 'bwipe ' . s:wipebuf
endif
unlet! s:wipebuf
set winheight=1 winwidth=20
let &shortmess = s:shortmess_save
let &winminheight = s:save_winminheight
let &winminwidth = s:save_winminwidth
let s:sx = expand("<sfile>:p:r")."x.vim"
if filereadable(s:sx)
  exe "source " . fnameescape(s:sx)
endif
let &g:so = s:so_save | let &g:siso = s:siso_save
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
