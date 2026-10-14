"""Build a fixed public regional map offline; no operational coordinates go to vendors."""
import gzip,json,hashlib,argparse
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import reproject,Resampling
from rasterio.transform import from_origin
parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);args=parser.parse_args();root=args.source_dir
out=Path('maps/landcover');grid=np.zeros((4000,2000),dtype=np.uint8)
transform=from_origin(34,34,.001,.001)
for tile in ['N30E033','N33E033']:
 with rasterio.open(root/(tile+'.tif')) as src:
  temp=np.zeros_like(grid)
  window=rasterio.windows.from_bounds(34,max(30,src.bounds.bottom),36,min(34,src.bounds.top),src.transform).round_offsets().round_lengths()
  source=src.read(1,window=window)
  reproject(source=source,destination=temp,src_transform=src.window_transform(window),src_crs=src.crs,dst_transform=transform,dst_crs='EPSG:4326',src_nodata=0,dst_nodata=0,resampling=Resampling.mode,num_threads=2)
  grid[temp!=0]=temp[temp!=0]
raw=grid.tobytes();blob=gzip.compress(raw,compresslevel=9,mtime=0)
(out/'north-region-2021.bin.gz').write_bytes(blob)
meta={'source':'ESA WorldCover 2021 v200','source_resolution_m':10,'display_resolution_degrees':.001,'display_resolution_approx_m':100,'resampling':'categorical mode','west':34,'east':36,'south':30,'north':34,'width':2000,'height':4000,'nodata':0,'sha256_raw':hashlib.sha256(raw).hexdigest(),'sha256_gzip':hashlib.sha256(blob).hexdigest(),'attribution':'© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium','source_urls':['https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_'+x+'_Map.tif' for x in ['N30E033','N33E033']]}
(out/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print({'raw_bytes':len(raw),'compressed_bytes':len(blob),'coverage_cells':int((grid>0).sum()),'classes':np.unique(grid).tolist()})
