CC=emcc

CFITSIO_VERSION = 4.1.0
ZLIB_VERSION = 1.2.12

CFITSIO_FNAME := cfitsio-$(CFITSIO_VERSION).tar.gz
ZLIB_FNAME := zlib-$(ZLIB_VERSION).tar.gz

SRCDIR  = src
OBJDIR  = bin
DISTDIR = dist

# Required for CFITSIO
CFLAGS_CFITSIO = \
	-DHAVE_UNION_SEMUN \
	-DHAVE_NET_SERVICES \
	-D__x86_64__

CFLAGS_DEF = $(CFLAGS_CFITSIO)

# Include GIT information
AN_GIT_REVISION ?= v0.0.1
AN_GIT_DATE ?= $(shell git log -n 1 --format=%cd | sed 's/ /_/g')
AN_GIT_URL := https://github.com/lhsnow/jsfitsio

CFLAGS_DEF += -DAN_GIT_REVISION='"$(AN_GIT_REVISION)"'
CFLAGS_DEF += -DAN_GIT_DATE='"$(AN_GIT_DATE)"'
CFLAGS_DEF += -DAN_GIT_URL='"$(AN_GIT_URL)"'

# Prod
EMFLAGS = -O3

# Debug
# EMFLAGS = -O0 -s ASSERTIONS=1

# Emscripten Flags
EMFLAGS += \
	-s WASM=1 \
	-s EXPORTED_FUNCTIONS='["_maxFITSMemory"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s TOTAL_MEMORY=134217728 \
	-s NO_EXIT_RUNTIME=1 \
	-s FORCE_FILESYSTEM=1 \
	-s EXPORT_NAME="'jsFITSio'" \
	-s NODEJS_CATCH_EXIT=k1 \
	-s INVOKE_RUN=0 \
	-s MODULARIZE=1 \
	--memory-init-file 0 \
	--pre-js $(SRCDIR)/js-wrapper.js

CFITSIO = $(SRCDIR)/cfitsio
ZLIB = $(SRCDIR)/zlib
JSFITSIO = $(SRCDIR)/jsfitsio

CFLAGS = -Wall \
	-I$(SRCDIR)/ \
	-I$(CFITSIO) \
	-I$(ZLIB) \
	-I$(JSFITSIO) \
	$(CFLAGS_DEF) \
	$(EMFLAGS)

CFITSIO_SRC := $(addprefix $(CFITSIO)/, buffers.c cfileio.c checksum.c \
	drvrfile.c drvrmem.c drvrnet.c drvrsmem.c drvrgsiftp.c editcol.c edithdu.c \
	eval_l.c eval_y.c eval_f.c fitscore.c getcol.c getcolb.c getcold.c getcole.c \
	getcoli.c getcolj.c getcolk.c getcoll.c getcols.c getcolsb.c getcoluk.c \
	getcolui.c getcoluj.c getkey.c group.c grparser.c histo.c iraffits.c modkey.c \
	putcol.c putcolb.c putcold.c putcole.c putcoli.c putcolj.c putcolk.c \
	putcoluk.c putcoll.c putcols.c putcolsb.c putcolu.c putcolui.c putcoluj.c \
	putkey.c region.c scalnull.c swapproc.c wcssub.c wcsutil.c imcompress.c \
	quantize.c ricecomp.c pliocomp.c fits_hcompress.c fits_hdecompress.c \
	simplerng.c zuncompress.c zcompress.c )

ZLIB_SRC := $(addprefix $(ZLIB)/, \
	adler32.c crc32.c inffast.c inftrees.c trees.c \
	zutil.c deflate.c infback.c inflate.c uncompr.c)

JSFITSIO_SRC := $(addprefix $(JSFITSIO)/, \
	jsfitsio.c)

SRCS := $(ZLIB_SRC) $(CFITSIO_SRC) $(JSFITSIO_SRC)
OBJS := $(patsubst %.c,$(OBJDIR)/%.o,$(SRCS))

APP = $(DISTDIR)/jsfitsio.js $(DISTDIR)/jsfitsio.wasm

$(OBJDIR)/%.o: %.c
	@mkdir -p $(@D)
	$(CC) -c $< -o $@ $(CFLAGS)

$(APP): $(OBJS)
	@mkdir -p $(@D)
	$(CC) $(CFLAGS) -o $@ $(OBJS)

$(CFITSIO_SRC): $(CFITSIO_FNAME)

$(ZLIB_SRC): $(ZLIB_FNAME)

$(ZLIB_FNAME):
	@(mkdir $(ZLIB); \
	wget -N "https://zlib.net/$(ZLIB_FNAME)"; \
	tar -zvxf $(ZLIB_FNAME) --strip-components=1 -C $(ZLIB);)

$(CFITSIO_FNAME):
	@(mkdir $(CFITSIO); \
	wget -N "http://heasarc.gsfc.nasa.gov/FTP/software/fitsio/c/$(CFITSIO_FNAME)"; \
	tar -zvxf $(CFITSIO_FNAME) --strip-components=1 -C "$(CFITSIO)";)

all: $(APP)

clean:
	$(RM) $(APP) $(OBJS)
