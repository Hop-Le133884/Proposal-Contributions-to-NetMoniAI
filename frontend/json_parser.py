import xml.etree.ElementTree as ET
import json
import collections

def convert_netanim_xml_to_json(xml_file_path):
    """
    Converts NetAnim XML to JSON files for D3.js visualization.

    Args:
        xml_file_path (str): Path to the NetAnim XML file.

    Generates:
        nodes_data.json: Contains node ID (IP), x, and y coordinates.
        packets_data.json: Contains packet transmission details (src_ip, dst_ip, start_time, end_time).
    """
    try:
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}")
        return
    except FileNotFoundError:
        print(f"Error: XML file '{xml_file_path}' not found.")
        return

    nodes_output = []
    node_ip_map = {} # Maps node_id (e.g., "0", "1") to its primary IP address
    node_coords = {} # Maps node_id to its locX, locY

    # Extract node locations and IP addresses
    for node_elem in root.findall('.//node'):
        node_id = node_elem.get('id')
        loc_x = float(node_elem.get('locX'))
        loc_y = float(node_elem.get('locY'))
        node_coords[node_id] = {'x': loc_x, 'y': loc_y}

    for ip_elem in root.findall('.//ip'):
        node_id_ref = ip_elem.get('n')
        # Use the first IPv4 address found for the node, ignore 127.0.0.1 if other options exist
        main_ip = None
        addresses = ip_elem.findall('./address')
        for addr_elem in addresses:
            ip = addr_elem.text.strip()
            if ip and '.' in ip: # Basic check for IPv4
                if ip != "127.0.0.1":
                    main_ip = ip
                    break
                elif main_ip is None: # Fallback to 127.0.0.1 if it's the only one
                    main_ip = ip
        
        if main_ip and node_id_ref not in node_ip_map : # Only add if not already mapped by a more preferred IP
             if node_id_ref in node_coords:
                node_ip_map[node_id_ref] = main_ip


    # Prepare nodes_data.json content
    # Scale coordinates for visualization: find min/max to normalize
    all_x = [coords['x'] for coords in node_coords.values()]
    all_y = [coords['y'] for coords in node_coords.values()]
    
    min_x, max_x = min(all_x) if all_x else 0, max(all_x) if all_x else 1
    min_y, max_y = min(all_y) if all_y else 0, max(all_y) if all_y else 1

    # Add some padding for the canvas
    padding = 50 
    viz_width = 750 # Target SVG width for scaling
    viz_height = 550 # Target SVG height for scaling

    def scale_x(val):
        if max_x == min_x: return padding
        return padding + (val - min_x) / (max_x - min_x) * (viz_width - 2 * padding)

    def scale_y(val):
        if max_y == min_y: return padding
        return padding + (val - min_y) / (max_y - min_y) * (viz_height - 2 * padding)

    for node_id, ip_address in node_ip_map.items():
        if node_id in node_coords:
            coords = node_coords[node_id]
            nodes_output.append({
                'id': ip_address, # Use IP address as the unique ID for D3
                'original_id': node_id,
                'x': scale_x(coords['x']),
                'y': scale_y(coords['y'])
            })
    
    with open('public/nodes_data.json', 'w') as f:
        json.dump(nodes_output, f, indent=2)
    print("Generated nodes_data.json")

    packets_output = []
    # Track packet transmissions (<pr>)
    # We will associate them with wireless packet receptions (<wpr>)
    # The <pr> uId is the sender, <wpr> tId is the receiver.
    # Both <pr> and <wpr> share the <pr> uId attribute as the sender ID.

    packet_transmissions = {} # Key: (pr_uId, pr_fId), Value: fbTx

    for pr_elem in root.findall('.//pr'):
        u_id = pr_elem.get('uId') # Transmitting node ID
        f_id = pr_elem.get('fId') # Flow/Packet ID
        fb_tx = float(pr_elem.get('fbTx')) # First bit transmit time
        
        # Store transmission start time; a packet might be received by multiple nodes
        # If we consider fId unique per packet across the simulation, this is fine.
        # If fId is only unique per *sender*, then (u_id, f_id) might not be globally unique.
        # For NetAnim, uId in <pr> is the sender.
        # We'll assume that (u_id, fb_tx) can uniquely identify a transmission event for matching wpr.
        # A simpler approach: match wpr events based on uId and approximate time.
        # However, the provided structure implies uId in wpr is the *original sender* of the packet seen in pr.
        
        # Let's collect all transmissions by a node ID
        if u_id not in packet_transmissions:
            packet_transmissions[u_id] = []
        packet_transmissions[u_id].append({'fbTx': fb_tx, 'fId': f_id})


    for wpr_elem in root.findall('.//wpr'):
        src_node_id_from_wpr = wpr_elem.get('uId') # This is the uId of the original transmitter <pr>
        dst_node_id = wpr_elem.get('tId')         # Target/Receiving node ID
        fb_rx = float(wpr_elem.get('fbRx'))       # First bit receive time
        
        src_ip = node_ip_map.get(src_node_id_from_wpr)
        dst_ip = node_ip_map.get(dst_node_id)

        if not src_ip or not dst_ip:
            # print(f"Warning: Could not find IP for src_node_id {src_node_id_from_wpr} or dst_node_id {dst_node_id}. Skipping packet.")
            continue

        # Find the corresponding pr_elem (transmission start)
        # This is tricky because there's no direct link other than uId and time proximity.
        # We assume <wpr> elements follow their corresponding <pr> element for the same uId.
        # For simplicity, we'll find the <pr> with the closest fbTx <= fbRx for that uId.
        
        # A better heuristic: The NetAnim XML usually lists <pr> then all its <wpr>s.
        # We can iterate through <pr>s, then for each <pr>, find <wpr>s that share its uId and have fbRx >= fbTx.
        # The provided file structure is more like <pr> then a series of <wpr> for that <pr> uId (sender).

        # Re-evaluating: The elements are interleaved.
        # The structure seems to be:
        # <pr uId="A" ... fbTx="T1" />  (A starts sending)
        # <wpr uId="A" tId="B" fbRx="T2" /> (B receives from A)
        # <wpr uId="A" tId="C" fbRx="T3" /> (C receives from A)
        # ...
        # <pr uId="D" ... fbTx="T4" /> (D starts sending)

        # We need to find the *most recent* fbTx from src_node_id_from_wpr that is <= fb_rx.
        # This is still complex if a node sends multiple packets quickly.
        
        # Let's try a different approach: Iterate through all elements in order.
        # Keep track of the "current" transmitting node and its transmit time.
        # This assumes that <pr> always immediately precedes its related <wpr>s for that transmission burst.

        # Given the snippet `pr uId="1" fId="3" fbTx="0.00015" /> <wpr uId="1" tId="1" fbRx="0.000154019" /> ...`
        # it seems the `uId` in `wpr` is indeed the sender from a preceding `pr`.
        # We need to find the `fbTx` for the packet being received.
        # The issue is that `fId` is not present in `wpr`.

        # A simpler interpretation based on the goal: we care about *a* packet flowing.
        # The `pr` elements signify a transmission from `uId` starting at `fbTx`.
        # The `wpr` elements signify a reception at `tId` from `uId` ending at `fbRx`.
        # The crucial link is the `uId` in `wpr`, which points to the *source* node of that particular wireless hop.
        # We need the `fbTx` that *initiated* this `wpr` event.

        # Let's process elements chronologically and store the last `fbTx` for each `uId`.
        # This is not robust if a node interleaves sending to different receivers from different original packets.

        # The XML structure is `<pr uId="SENDER" ... fbTx="T_SEND" />` followed by one or more `<wpr uId="SENDER" tId="RECEIVER" fbRx="T_RECEIVE" />`
        # The `fbTx` from the `pr` applies to all subsequent `wpr`s that share the same `uId` (sender) until a new `pr` for that `uId` appears or a `pr` for another `uId`.

        # Simpler: The `fbTx` on the `<pr>` is the start time, the `fbRx` on the `<wpr>` is the end time.
        # The `uId` on the `<pr>` is the source. The `tId` on the `<wpr>` is the destination.
        # The `uId` on the `<wpr>` confirms the source for that reception.
        
        # Iterate elements, when <pr> is found, store its fbTx. When <wpr> is found, use the stored fbTx if uId matches.
        
        # Let's store the last fbTx per uId.
        # This is still imperfect if there are multiple in-flight packets from the same uId.
        # The prompt asks for *a* packet flow. The `fbTx` in `pr` and `fbRx` in `wpr` define one segment of flow.

        # A better approach for parsing based on typical NetAnim structure:
        # Group <wpr> by the <pr> that logically precedes them and shares the same `uId` (sender).

    current_sender_ftx = {} # uId -> fbTx of the last <pr> for that uId

    for elem in root: # Iterate direct children of <anim>
        if elem.tag == 'pr':
            u_id = elem.get('uId')
            fb_tx = float(elem.get('fbTx'))
            current_sender_ftx[u_id] = fb_tx # Record the latest transmission time for this sender
        
        elif elem.tag == 'wpr':
            src_node_id_from_wpr = elem.get('uId') # This is the uId of the original transmitter
            dst_node_id = elem.get('tId')         # Target/Receiving node ID
            fb_rx = float(elem.get('fbRx'))       # First bit receive time

            src_ip = node_ip_map.get(src_node_id_from_wpr)
            dst_ip = node_ip_map.get(dst_node_id)

            if not src_ip or not dst_ip:
                continue

            # Get the transmission start time for this packet
            # This assumes the wpr belongs to the most recent pr from src_node_id_from_wpr
            transmit_start_time = current_sender_ftx.get(src_node_id_from_wpr)

            if transmit_start_time is not None and transmit_start_time <= fb_rx :
                packets_output.append({
                    'src': src_ip,
                    'dst': dst_ip,
                    'timestamp_start': transmit_start_time,
                    'timestamp_end': fb_rx,
                    # 'size': 10 # Default size, as it's not in these tags.
                })
            # else:
                # print(f"Warning: Could not find matching pr for wpr (src_uId: {src_node_id_from_wpr}, dst_tId: {dst_node_id}, fbRx: {fb_rx}). Or fbTx > fbRx.")


    # Sort packets by start timestamp for ordered animation
    packets_output.sort(key=lambda p: p['timestamp_start'])

    with open('public/packets_data.json', 'w') as f:
        json.dump(packets_output, f, indent=2)
    print("Generated packets_data.json")

if __name__ == '__main__':
    # Assuming 'simulation.xml' is in the same directory as the script
    convert_netanim_xml_to_json('/Users/thanikella_nikhil/Projects-Courses/MS-Project/agents/backend/segregated/segregated_pcaps13/syn-flood-animation.xml')