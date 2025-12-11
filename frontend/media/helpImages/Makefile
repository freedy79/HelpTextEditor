# Generates .png files from .svg sources, so that they can be displayed in the
# document viewer on the device. The .svg files are still used by the Website.

SRC_FILES := $(wildcard *.svg)
DST_FILES := $(SRC_FILES:.svg=.png)

all: $(DST_FILES)

%.png: %.svg
	ffmpeg -y -i $< $@
