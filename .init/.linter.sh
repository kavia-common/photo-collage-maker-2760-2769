#!/bin/bash
cd /tmp/kavia/workspace/code-generation/photo-collage-maker-2760-2769/photo_collage_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

