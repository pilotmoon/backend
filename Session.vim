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
badd +4 ~/work/chewit/index.ts
badd +7 dist/src/canonicalizeEmail.js
badd +4 term://~/work/backend//99624:/bin/zsh
badd +11 term://~/work/backend//230:/bin/zsh
badd +164 term://~/work/backend//868:/bin/zsh
badd +19 .env-twix
badd +1 ~/work/backend
badd +55 term://~/work/backend//9368:/bin/zsh
badd +0 term://~/work/backend//9825:/bin/zsh
badd +0 term://~/work/backend//9913:/bin/zsh
argglobal
%argdel
$argadd ~/work/backend
set stal=2
tabnew +setlocal\ bufhidden=wipe
tabrewind
argglobal
if bufexists(fnamemodify("term://~/work/backend//9368:/bin/zsh", ":p")) | buffer term://~/work/backend//9368:/bin/zsh | else | edit term://~/work/backend//9368:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//9368:/bin/zsh
endif
balt .env-twix
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 55 - ((0 * winheight(0) + 23) / 46)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 55
normal! 066|
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
exe 'vert 1resize ' . ((&columns * 81 + 81) / 162)
exe '2resize ' . ((&lines * 23 + 24) / 49)
exe 'vert 2resize ' . ((&columns * 80 + 81) / 162)
exe '3resize ' . ((&lines * 22 + 24) / 49)
exe 'vert 3resize ' . ((&columns * 80 + 81) / 162)
argglobal
if bufexists(fnamemodify("term://~/work/backend//868:/bin/zsh", ":p")) | buffer term://~/work/backend//868:/bin/zsh | else | edit term://~/work/backend//868:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//868:/bin/zsh
endif
balt term://~/work/backend//230:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 913 - ((30 * winheight(0) + 23) / 46)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 913
normal! 043|
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//9825:/bin/zsh", ":p")) | buffer term://~/work/backend//9825:/bin/zsh | else | edit term://~/work/backend//9825:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//9825:/bin/zsh
endif
balt term://~/work/backend//868:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 1191 - ((22 * winheight(0) + 11) / 23)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 1191
normal! 0
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//9913:/bin/zsh", ":p")) | buffer term://~/work/backend//9913:/bin/zsh | else | edit term://~/work/backend//9913:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//9913:/bin/zsh
endif
balt term://~/work/backend//868:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 287 - ((21 * winheight(0) + 11) / 22)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 287
normal! 0
lcd ~/work/backend
wincmd w
exe 'vert 1resize ' . ((&columns * 81 + 81) / 162)
exe '2resize ' . ((&lines * 23 + 24) / 49)
exe 'vert 2resize ' . ((&columns * 80 + 81) / 162)
exe '3resize ' . ((&lines * 22 + 24) / 49)
exe 'vert 3resize ' . ((&columns * 80 + 81) / 162)
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
