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
badd +6 term://~/work/backend//99624:/bin/zsh
badd +325 term://~/work/backend//230:/bin/zsh
badd +6179 term://~/work/backend//868:/bin/zsh
badd +16 .env-twix
badd +1 ~/work/backend
argglobal
%argdel
$argadd ~/work/backend
edit .env-twix
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
split
1wincmd k
wincmd w
wincmd _ | wincmd |
vsplit
wincmd _ | wincmd |
vsplit
2wincmd h
wincmd w
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
exe '1resize ' . ((&lines * 34 + 24) / 48)
exe '2resize ' . ((&lines * 11 + 24) / 48)
exe 'vert 2resize ' . ((&columns * 53 + 91) / 182)
exe '3resize ' . ((&lines * 11 + 24) / 48)
exe 'vert 3resize ' . ((&columns * 54 + 91) / 182)
exe '4resize ' . ((&lines * 11 + 24) / 48)
exe 'vert 4resize ' . ((&columns * 73 + 91) / 182)
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
let s:l = 16 - ((15 * winheight(0) + 17) / 34)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 16
normal! 0
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//99624:/bin/zsh", ":p")) | buffer term://~/work/backend//99624:/bin/zsh | else | edit term://~/work/backend//99624:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//99624:/bin/zsh
endif
balt ~/work/backend/dist/src/canonicalizeEmail.js
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 11 - ((10 * winheight(0) + 5) / 11)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 11
normal! 0
lcd ~/work/backend
wincmd w
argglobal
if bufexists(fnamemodify("term://~/work/backend//230:/bin/zsh", ":p")) | buffer term://~/work/backend//230:/bin/zsh | else | edit term://~/work/backend//230:/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/work/backend//230:/bin/zsh
endif
balt term://~/work/backend//99624:/bin/zsh
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
let s:l = 11 - ((10 * winheight(0) + 5) / 11)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 11
normal! 0
lcd ~/work/backend
wincmd w
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
let s:l = 11 - ((10 * winheight(0) + 5) / 11)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 11
normal! 0
lcd ~/work/backend
wincmd w
exe '1resize ' . ((&lines * 34 + 24) / 48)
exe '2resize ' . ((&lines * 11 + 24) / 48)
exe 'vert 2resize ' . ((&columns * 53 + 91) / 182)
exe '3resize ' . ((&lines * 11 + 24) / 48)
exe 'vert 3resize ' . ((&columns * 54 + 91) / 182)
exe '4resize ' . ((&lines * 11 + 24) / 48)
exe 'vert 4resize ' . ((&columns * 73 + 91) / 182)
tabnext 1
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
nohlsearch
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
